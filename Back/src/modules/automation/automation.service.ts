import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataBaseService } from '../../database/database.service';
import { AccountingService } from '../accounting/accounting.service';
import { TenantContext, TenantService } from '../tenant/tenant.service';
import { RecurringEntryDto } from './dto';

type MonthlyActual = {
  month: string;
  revenue: number;
  expenses: number;
  cashCollected: number;
  vendorPaid: number;
  revenueRecordIds: string[];
  expenseRecordIds: string[];
  paymentRecordIds: string[];
  vendorPaymentRecordIds: string[];
};

type ForecastSeries = {
  method: string;
  formula: string;
  values: number[];
  growthRate: number;
  seasonalFactors: number[];
  varianceCoefficient: number;
};

type ForecastConfidence = {
  score: number;
  explanation: string;
  factors: {
    historicalDataAvailability: number;
    historicalVariance: number;
    seasonalConsistency: number;
    dataCompleteness: number;
  };
};

@Injectable()
export class AutomationService {
  constructor(
    private readonly db: DataBaseService,
    private readonly tenant: TenantService,
    private readonly accounting: AccountingService,
  ) {}

  async createRecurringEntry(ctx: TenantContext, userId: string, dto: RecurringEntryDto) {
    const schema = this.tenant.quote(ctx.schemaName);
    const rows = await this.db.$queryRawUnsafe<{ id: string }[]>(
      `INSERT INTO ${schema}.recurring_entries
       (name, frequency, start_date, end_date, next_run, template, created_by)
       VALUES ($1, $2, $3::date, $4::date, $3::date, $5::jsonb, $6::uuid)
       RETURNING id`,
      dto.name,
      dto.frequency,
      dto.startDate,
      dto.endDate ?? null,
      JSON.stringify({ lines: dto.lines }),
      userId,
    );
    return rows[0];
  }

  async listRecurringEntries(ctx: TenantContext) {
    const schema = this.tenant.quote(ctx.schemaName);
    return this.db.$queryRawUnsafe(`SELECT * FROM ${schema}.recurring_entries ORDER BY created_at DESC`);
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async runRecurringEntriesForAllTenants() {
    const orgs = await this.db.organization.findMany();
    for (const org of orgs) {
      await this.runRecurringEntries({
        organizationId: org.id,
        schemaName: org.schemaName,
        role: 'system',
      });
    }
  }

  async runRecurringEntries(ctx: TenantContext) {
    const schema = this.tenant.quote(ctx.schemaName);
    const entries = await this.db.$queryRawUnsafe<
      { id: string; name: string; frequency: string; next_run: Date; created_by: string; template: { lines: { accountId: string; debit: number; credit: number; description?: string }[] } }[]
    >(
      `SELECT * FROM ${schema}.recurring_entries
       WHERE is_active = true AND next_run <= CURRENT_DATE AND (end_date IS NULL OR end_date >= CURRENT_DATE)`,
    );
    for (const entry of entries) {
      try {
        const je = await this.accounting.createJournalEntry(ctx, entry.created_by, {
          date: new Date().toISOString().slice(0, 10),
          description: `Recurring entry: ${entry.name}`,
          lines: entry.template.lines,
        }, 'recurring_entry', entry.id);
        await this.db.$executeRawUnsafe(
          `INSERT INTO ${schema}.recurring_entry_logs (recurring_entry_id, journal_entry_id, generated_date, status)
           VALUES ($1::uuid, $2::uuid, CURRENT_DATE, 'generated')`,
          entry.id,
          je.id,
        );
        await this.db.$executeRawUnsafe(
          `UPDATE ${schema}.recurring_entries
           SET next_run = CASE frequency
             WHEN 'weekly' THEN next_run + INTERVAL '7 days'
             WHEN 'yearly' THEN next_run + INTERVAL '1 year'
             ELSE next_run + INTERVAL '1 month'
           END
           WHERE id = $1::uuid`,
          entry.id,
        );
      } catch {
        await this.db.$executeRawUnsafe(
          `INSERT INTO ${schema}.recurring_entry_logs (recurring_entry_id, generated_date, status)
           VALUES ($1::uuid, CURRENT_DATE, 'failed')`,
          entry.id,
        );
      }
    }
    return { processed: entries.length };
  }

  async dashboard(ctx: TenantContext) {
    const schema = this.tenant.quote(ctx.schemaName);
    const rows = await this.db.$queryRawUnsafe<
      { account_type: string; balance: string }[]
    >(
      `SELECT a.type AS account_type, COALESCE(SUM(jl.debit - jl.credit), 0) AS balance
       FROM ${schema}.accounts a
       LEFT JOIN ${schema}.journal_lines jl ON jl.account_id = a.id
       GROUP BY a.type`,
    );
    const value = (type: string) => Number(rows.find((r) => r.account_type === type)?.balance ?? 0);
    const ar = await this.sum(ctx, 'invoices', "status IN ('unpaid','partial')");
    const ap = await this.sum(ctx, 'vendor_bills', "status IN ('received','partial')");
    return {
      cash: value('Asset'),
      revenue: -value('Revenue'),
      expenses: value('Expense'),
      netIncome: -value('Revenue') - value('Expense'),
      accountsReceivable: ar,
      accountsPayable: ap,
    };
  }

  async forecast(ctx: TenantContext, months = 12) {
    const horizon = Math.min(Math.max(Math.trunc(months) || 12, 1), 36);
    const actuals = await this.monthlyFinancialActuals(ctx);
    const sourceRecords = await this.forecastSourceRecords(ctx);
    const revenueSeries = this.buildForecastSeries(
      actuals.map((item) => item.revenue),
      actuals.map((item) => item.month),
      horizon,
      'Revenue',
    );
    const expenseSeries = this.buildForecastSeries(
      actuals.map((item) => item.expenses),
      actuals.map((item) => item.month),
      horizon,
      'Expense',
    );
    const confidence = this.forecastConfidence(actuals);
    const intervalRatio = 1 - confidence.score / 100;

    const result = Array.from({ length: horizon }, (_, index) => {
      const date = new Date();
      date.setUTCDate(1);
      date.setUTCMonth(date.getUTCMonth() + index + 1);
      const predictedRevenue = this.roundMoney(revenueSeries.values[index] ?? 0);
      const predictedExpense = this.roundMoney(expenseSeries.values[index] ?? 0);
      const predictedCashflow = this.roundMoney(predictedRevenue - predictedExpense);
      const interval = Math.abs(predictedCashflow) * intervalRatio;

      return {
        forecastMonth: date.toISOString().slice(0, 10),
        predictedRevenue,
        predictedExpense,
        predictedCashflow,
        confidenceLow: this.roundMoney(predictedCashflow - interval),
        confidenceHigh: this.roundMoney(predictedCashflow + interval),
        formulaUsed: 'Cash flow forecast generated as forecast revenue minus forecast expenses.',
        calculationDetails: {
          revenueMethod: revenueSeries.method,
          expenseMethod: expenseSeries.method,
          revenueGrowthRate: this.roundRate(revenueSeries.growthRate),
          expenseGrowthRate: this.roundRate(expenseSeries.growthRate),
          seasonalFactorApplied: {
            revenue: this.roundRate(revenueSeries.seasonalFactors[index] ?? 1),
            expenses: this.roundRate(expenseSeries.seasonalFactors[index] ?? 1),
          },
        },
      };
    });

    return {
      modelVersion: 'deterministic-formula-v1',
      forecastPrinciples: {
        deterministic: true,
        externalDataUsed: false,
        aiOrMlUsed: false,
        tenantIsolation: `Calculated only from tenant schema ${ctx.schemaName}.`,
      },
      method: {
        revenue: revenueSeries.method,
        expenses: expenseSeries.method,
        cashflow: 'Cash Flow Projection Model',
      },
      formulaUsed: [
        revenueSeries.formula,
        expenseSeries.formula,
        'Cash flow forecast = predicted revenue - predicted expenses.',
      ],
      sourceData: {
        historicalPeriods: actuals.map((item) => item.month),
        tables: ['accounts', 'journal_entries', 'journal_lines'],
        records: sourceRecords,
      },
      calculationDetails: {
        forecastHorizonMonths: horizon,
        historicalPeriodCount: actuals.length,
        revenueGrowthRate: this.roundRate(revenueSeries.growthRate),
        expenseGrowthRate: this.roundRate(expenseSeries.growthRate),
        revenueVarianceCoefficient: this.roundRate(revenueSeries.varianceCoefficient),
        expenseVarianceCoefficient: this.roundRate(expenseSeries.varianceCoefficient),
        monthlyActuals: actuals,
      },
      confidence,
      months: result,
    };
  }

  async listAlerts(ctx: TenantContext) {
    const schema = this.tenant.quote(ctx.schemaName);
    return this.db.$queryRawUnsafe(`SELECT * FROM ${schema}.alerts ORDER BY created_at DESC`);
  }

  async evaluateAlerts(ctx: TenantContext) {
    const schema = this.tenant.quote(ctx.schemaName);
    await this.db.$executeRawUnsafe(
      `INSERT INTO ${schema}.alerts (type, severity, title, message, entity_type, entity_id)
       SELECT 'due_date', 'warning', 'Invoice due soon', 'Invoice ' || invoice_number || ' is due by ' || due_date, 'invoice', id
       FROM ${schema}.invoices
       WHERE status IN ('unpaid','partial') AND due_date <= CURRENT_DATE + INTERVAL '7 days'
       ON CONFLICT DO NOTHING`,
    );
    return this.listAlerts(ctx);
  }

  async suggestions(ctx: TenantContext) {
    const schema = this.tenant.quote(ctx.schemaName);
    const dashboard = await this.dashboard(ctx);
    if (dashboard.expenses > dashboard.revenue * 0.7 && dashboard.revenue > 0) {
      await this.db.$executeRawUnsafe(
        `INSERT INTO ${schema}.suggestions (type, title, description)
         VALUES ('cost_optimization', 'Review high expense ratio', 'Expenses are above 70% of revenue. Review recurring and discretionary spend.')`,
      );
    }
    return this.db.$queryRawUnsafe(`SELECT * FROM ${schema}.suggestions WHERE status = 'active' ORDER BY created_at DESC`);
  }

  private async sum(ctx: TenantContext, table: string, where: string): Promise<number> {
    const schema = this.tenant.quote(ctx.schemaName);
    const rows = await this.db.$queryRawUnsafe<{ total: string }[]>(
      `SELECT COALESCE(SUM(total), 0) AS total FROM ${schema}.${table} WHERE ${where}`,
    );
    return Number(rows[0]?.total ?? 0);
  }

  private async monthlyFinancialActuals(ctx: TenantContext): Promise<MonthlyActual[]> {
    const schema = this.tenant.quote(ctx.schemaName);
    const rows = await this.db.$queryRawUnsafe<
      {
        month: Date;
        revenue: string;
        expenses: string;
        cash_collected: string;
        vendor_paid: string;
        revenue_record_ids: string[] | null;
        expense_record_ids: string[] | null;
        payment_record_ids: string[] | null;
        vendor_payment_record_ids: string[] | null;
      }[]
    >(
      `WITH RECURSIVE account_hierarchy AS (
         SELECT id, parent_id, type AS root_type
           FROM ${schema}.accounts
          WHERE parent_id IS NULL
         UNION ALL
         SELECT child.id, child.parent_id, parent.root_type
           FROM ${schema}.accounts child
           JOIN account_hierarchy parent ON parent.id = child.parent_id
       ),
       monthly AS (
         SELECT date_trunc('month', je.date)::date AS month,
                SUM(CASE WHEN hierarchy.root_type = 'Revenue'
                  THEN jl.credit - jl.debit ELSE 0 END)::numeric AS revenue,
                SUM(CASE WHEN hierarchy.root_type = 'Expense'
                  THEN jl.debit - jl.credit ELSE 0 END)::numeric AS expenses,
                0::numeric AS cash_collected,
                0::numeric AS vendor_paid,
                array_agg(DISTINCT je.id::text)
                  FILTER (WHERE hierarchy.root_type = 'Revenue') AS revenue_record_ids,
                array_agg(DISTINCT je.id::text)
                  FILTER (WHERE hierarchy.root_type = 'Expense') AS expense_record_ids,
                ARRAY[]::text[] AS payment_record_ids,
                ARRAY[]::text[] AS vendor_payment_record_ids
           FROM ${schema}.journal_entries je
           JOIN ${schema}.journal_lines jl ON jl.journal_entry_id = je.id
           JOIN account_hierarchy hierarchy ON hierarchy.id = jl.account_id
          WHERE je.status = 'posted'
            AND hierarchy.root_type IN ('Revenue', 'Expense')
          GROUP BY 1
         UNION ALL
         SELECT date_trunc('month', payment_date)::date AS month,
                0::numeric AS revenue,
                0::numeric AS expenses,
                SUM(amount)::numeric AS cash_collected,
                0::numeric AS vendor_paid,
                ARRAY[]::text[] AS revenue_record_ids,
                ARRAY[]::text[] AS expense_record_ids,
                array_agg(id::text ORDER BY payment_date, id) AS payment_record_ids,
                ARRAY[]::text[] AS vendor_payment_record_ids
           FROM ${schema}.customer_payments
          GROUP BY 1
         UNION ALL
         SELECT date_trunc('month', payment_date)::date AS month,
                0::numeric AS revenue,
                0::numeric AS expenses,
                0::numeric AS cash_collected,
                SUM(amount)::numeric AS vendor_paid,
                ARRAY[]::text[] AS revenue_record_ids,
                ARRAY[]::text[] AS expense_record_ids,
                ARRAY[]::text[] AS payment_record_ids,
                array_agg(id::text ORDER BY payment_date, id) AS vendor_payment_record_ids
           FROM ${schema}.vendor_payments
          GROUP BY 1
       )
       SELECT month,
              COALESCE(SUM(revenue), 0) AS revenue,
              COALESCE(SUM(expenses), 0) AS expenses,
              COALESCE(SUM(cash_collected), 0) AS cash_collected,
              COALESCE(SUM(vendor_paid), 0) AS vendor_paid,
              COALESCE(array_remove(string_to_array(string_agg(NULLIF(array_to_string(revenue_record_ids, ','), ''), ','), ','), NULL), ARRAY[]::text[]) AS revenue_record_ids,
              COALESCE(array_remove(string_to_array(string_agg(NULLIF(array_to_string(expense_record_ids, ','), ''), ','), ','), NULL), ARRAY[]::text[]) AS expense_record_ids,
              COALESCE(array_remove(string_to_array(string_agg(NULLIF(array_to_string(payment_record_ids, ','), ''), ','), ','), NULL), ARRAY[]::text[]) AS payment_record_ids,
              COALESCE(array_remove(string_to_array(string_agg(NULLIF(array_to_string(vendor_payment_record_ids, ','), ''), ','), ','), NULL), ARRAY[]::text[]) AS vendor_payment_record_ids
         FROM monthly
        GROUP BY month
        ORDER BY month`,
    );

    const actuals = rows.map((row) => ({
      month: row.month.toISOString().slice(0, 10),
      revenue: this.roundMoney(row.revenue),
      expenses: this.roundMoney(row.expenses),
      cashCollected: this.roundMoney(row.cash_collected),
      vendorPaid: this.roundMoney(row.vendor_paid),
      revenueRecordIds: row.revenue_record_ids ?? [],
      expenseRecordIds: row.expense_record_ids ?? [],
      paymentRecordIds: row.payment_record_ids ?? [],
      vendorPaymentRecordIds: row.vendor_payment_record_ids ?? [],
    }));
    return this.fillMonthlyGaps(actuals);
  }

  private async forecastSourceRecords(ctx: TenantContext) {
    const schema = this.tenant.quote(ctx.schemaName);
    return this.db.$queryRawUnsafe(
      `WITH RECURSIVE account_hierarchy AS (
         SELECT id, parent_id, type AS root_type
           FROM ${schema}.accounts
          WHERE parent_id IS NULL
         UNION ALL
         SELECT child.id, child.parent_id, parent.root_type
           FROM ${schema}.accounts child
           JOIN account_hierarchy parent ON parent.id = child.parent_id
       )
       SELECT lower(hierarchy.root_type) || '_journal_entry' AS source_type,
              je.id,
              je.description AS reference,
              je.date AS record_date,
              SUM(CASE
                WHEN hierarchy.root_type = 'Revenue' THEN jl.credit - jl.debit
                ELSE jl.debit - jl.credit
              END)::numeric AS total
         FROM ${schema}.journal_entries je
         JOIN ${schema}.journal_lines jl ON jl.journal_entry_id = je.id
         JOIN account_hierarchy hierarchy ON hierarchy.id = jl.account_id
        WHERE je.status = 'posted'
          AND hierarchy.root_type IN ('Revenue', 'Expense')
        GROUP BY hierarchy.root_type, je.id, je.description, je.date
        ORDER BY record_date DESC
        LIMIT 250`,
    );
  }

  private fillMonthlyGaps(actuals: MonthlyActual[]): MonthlyActual[] {
    if (actuals.length < 2) return actuals;

    const byMonth = new Map(actuals.map((item) => [item.month.slice(0, 7), item]));
    const first = new Date(`${actuals[0].month.slice(0, 7)}-01T00:00:00.000Z`);
    const last = new Date(`${actuals[actuals.length - 1].month.slice(0, 7)}-01T00:00:00.000Z`);
    const filled: MonthlyActual[] = [];

    for (const cursor = new Date(first); cursor <= last; cursor.setUTCMonth(cursor.getUTCMonth() + 1)) {
      const monthKey = cursor.toISOString().slice(0, 7);
      filled.push(
        byMonth.get(monthKey) ?? {
          month: `${monthKey}-01`,
          revenue: 0,
          expenses: 0,
          cashCollected: 0,
          vendorPaid: 0,
          revenueRecordIds: [],
          expenseRecordIds: [],
          paymentRecordIds: [],
          vendorPaymentRecordIds: [],
        },
      );
    }

    return filled;
  }

  private buildForecastSeries(history: number[], historicalMonths: string[], horizon: number, label: string): ForecastSeries {
    const nonZeroHistory = history.filter((value) => value > 0);
    const varianceCoefficient = this.coefficientOfVariation(nonZeroHistory);
    const seasonalFactors = this.seasonalFactors(history, historicalMonths, horizon);

    if (nonZeroHistory.length >= 13) {
      const first = nonZeroHistory[0];
      const last = nonZeroHistory[nonZeroHistory.length - 1];
      const growthRate = first > 0 ? Math.pow(last / first, 1 / (nonZeroHistory.length - 1)) - 1 : 0;
      const base = nonZeroHistory[nonZeroHistory.length - 1] || 0;
      return {
        method: 'CAGR with Seasonal Adjustment',
        formula: `${label} forecast generated using CAGR with seasonal adjustment: latest actual x (1 + CAGR)^period x seasonal factor.`,
        values: Array.from({ length: horizon }, (_, index) =>
          Math.max(0, base * Math.pow(1 + growthRate, index + 1) * seasonalFactors[index]),
        ),
        growthRate,
        seasonalFactors,
        varianceCoefficient,
      };
    }

    if (nonZeroHistory.length >= 3) {
      const weights = [0.5, 0.3, 0.2];
      const latest = nonZeroHistory.slice(-3).reverse();
      const weightedAverage = latest.reduce((sum, value, index) => sum + value * weights[index], 0);
      const trend = this.linearTrend(nonZeroHistory);
      const growthRate = weightedAverage > 0 ? trend / weightedAverage : 0;
      return {
        method: 'Weighted Moving Average with Linear Trend Analysis',
        formula: `${label} forecast generated using weighted moving average (50%, 30%, 20%) plus linear monthly trend and seasonal factor.`,
        values: Array.from({ length: horizon }, (_, index) =>
          Math.max(0, (weightedAverage + trend * (index + 1)) * seasonalFactors[index]),
        ),
        growthRate,
        seasonalFactors,
        varianceCoefficient,
      };
    }

    const average = nonZeroHistory.length
      ? nonZeroHistory.reduce((sum, value) => sum + value, 0) / nonZeroHistory.length
      : 0;

    return {
      method: 'Historical Average Projection',
      formula: `${label} forecast generated using historical average projection because fewer than three historical periods are available.`,
      values: Array.from({ length: horizon }, () => average),
      growthRate: 0,
      seasonalFactors: Array.from({ length: horizon }, () => 1),
      varianceCoefficient,
    };
  }

  private forecastConfidence(actuals: MonthlyActual[]): ForecastConfidence {
    const periods = actuals.length;
    const completePeriods = actuals.filter((item) => item.revenue > 0 || item.expenses > 0).length;
    const netCash = actuals.map((item) => item.revenue - item.expenses);
    const variance = this.coefficientOfVariation(netCash.filter((value) => value !== 0).map(Math.abs));
    const availability = Math.min(1, periods / 12);
    const varianceScore = Math.max(0, 1 - Math.min(variance, 1));
    const seasonalConsistency = periods >= 12 ? varianceScore : Math.min(0.6, periods / 12);
    const completeness = periods ? completePeriods / periods : 0;
    const score = Math.round(
      (availability * 0.3 + varianceScore * 0.3 + seasonalConsistency * 0.2 + completeness * 0.2) * 100,
    );

    return {
      score,
      explanation:
        `Confidence is ${score}% based only on ${periods} tenant historical periods, ` +
        `${this.roundRate(variance)} historical variance coefficient, ` +
        `${this.roundRate(seasonalConsistency)} seasonal consistency, and ` +
        `${this.roundRate(completeness)} data completeness.`,
      factors: {
        historicalDataAvailability: this.roundRate(availability),
        historicalVariance: this.roundRate(varianceScore),
        seasonalConsistency: this.roundRate(seasonalConsistency),
        dataCompleteness: this.roundRate(completeness),
      },
    };
  }

  private seasonalFactors(history: number[], historicalMonths: string[], horizon: number): number[] {
    const positive = history.filter((value) => value > 0);
    if (positive.length < 12) {
      return Array.from({ length: horizon }, () => 1);
    }

    const average = positive.reduce((sum, value) => sum + value, 0) / positive.length;
    return Array.from({ length: horizon }, (_, index) => {
      const monthIndex = (new Date().getUTCMonth() + index + 1) % 12;
      const sameMonthValues = history.filter(
        (value, historyIndex) =>
          new Date(`${historicalMonths[historyIndex].slice(0, 10)}T00:00:00.000Z`).getUTCMonth() === monthIndex &&
          value > 0,
      );
      if (!sameMonthValues.length || average === 0) return 1;
      const sameMonthAverage = sameMonthValues.reduce((sum, value) => sum + value, 0) / sameMonthValues.length;
      return Math.min(1.5, Math.max(0.5, sameMonthAverage / average));
    });
  }

  private linearTrend(values: number[]): number {
    const count = values.length;
    const xMean = (count - 1) / 2;
    const yMean = values.reduce((sum, value) => sum + value, 0) / count;
    const denominator = values.reduce((sum, _value, index) => sum + Math.pow(index - xMean, 2), 0);
    if (denominator === 0) return 0;
    return values.reduce((sum, value, index) => sum + (index - xMean) * (value - yMean), 0) / denominator;
  }

  private coefficientOfVariation(values: number[]): number {
    if (!values.length) return 1;
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    if (average === 0) return 1;
    const variance = values.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / values.length;
    return Math.sqrt(variance) / Math.abs(average);
  }

  private roundMoney(value: number | string): number {
    return Number(Number(value).toFixed(2));
  }

  private roundRate(value: number): number {
    return Number(value.toFixed(4));
  }
}

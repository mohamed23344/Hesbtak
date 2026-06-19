import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as ExcelJS from 'exceljs';
import * as tls from 'node:tls';
import PDFDocument from 'pdfkit';
import { DataBaseService } from '../../database/database.service';
import { TenantContext, TenantService } from '../tenant/tenant.service';
import {
  CreateScheduleDto,
  GenerateReportDto,
  ReportConfigurationDto,
  ReportType,
  UpdateReportDto,
  UpdateScheduleDto,
} from './dto';
import { CUSTOM_FIELDS, REPORT_TEMPLATES } from './report-templates';

type ReportRow = Record<string, unknown>;
type Column = { key: string; label: string };

export interface GeneratedReport {
  title: string;
  reportType: ReportType;
  generatedAt: string;
  filters: Record<string, unknown>;
  columns: Column[];
  rows: ReportRow[];
  totals: Record<string, number>;
}

const GROUP_FIELDS: Partial<Record<ReportType, string[]>> = {
  profit_loss: ['type', 'account'],
  revenue: ['customer_name', 'month', 'quarter', 'year'],
  sales: ['customer_name', 'month', 'quarter', 'year'],
  customer_invoices: ['customer_name', 'month', 'quarter', 'year'],
  accounts_receivable: ['customer_name', 'month', 'quarter', 'year'],
  expense: ['vendor_name', 'bill_type', 'account_name', 'month', 'quarter', 'year'],
  accounts_payable: ['vendor_name', 'month', 'quarter', 'year'],
  vendor_payments: ['vendor_name', 'month', 'quarter', 'year'],
  tax: ['month', 'quarter', 'year'],
  cash_flow: ['month', 'quarter', 'year'],
  custom: ['customer_name', 'vendor_name', 'bill_type', 'account_name', 'month', 'quarter', 'year'],
};

const AGGREGATION_FIELDS: Partial<Record<ReportType, string[]>> = {
  profit_loss: ['amount'],
  balance_sheet: ['balance'],
  cash_flow: ['net_cash_flow'],
  revenue: ['total', 'subtotal', 'tax_amount'],
  expense: ['total', 'subtotal', 'tax_amount', 'paid_amount'],
  accounts_receivable: ['balance', 'total', 'paid'],
  accounts_payable: ['balance', 'total', 'paid'],
  sales: ['total', 'subtotal', 'tax_amount'],
  tax: ['tax_amount', 'total'],
  vendor_payments: ['amount'],
  customer_invoices: ['total', 'subtotal', 'tax_amount'],
  custom: ['total', 'amount', 'balance', 'subtotal', 'tax_amount', 'paid_amount'],
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly db: DataBaseService,
    private readonly tenant: TenantService,
  ) {}

  async templates(ctx: TenantContext) {
    await this.ensureStore(ctx);
    return {
      templates: REPORT_TEMPLATES,
      customFields: CUSTOM_FIELDS,
      groupFields: GROUP_FIELDS,
    };
  }

  async dashboard(ctx: TenantContext) {
    await this.ensureStore(ctx);
    const schema = this.tenant.quote(ctx.schemaName);
    const [counts, recent, used, upcoming] = await Promise.all([
      this.db.$queryRawUnsafe<
        Array<{ generated: bigint; scheduled: bigint; saved: bigint }>
      >(`SELECT
          (SELECT COUNT(*) FROM ${schema}.report_executions WHERE status = 'completed') generated,
          (SELECT COUNT(*) FROM ${schema}.scheduled_reports WHERE status = 'active') scheduled,
          (SELECT COUNT(*) FROM ${schema}.reports) saved`),
      this.db.$queryRawUnsafe(
        `SELECT e.id, r.name, r.report_type, e.completed_at, e.export_format, e.status
         FROM ${schema}.report_executions e
         LEFT JOIN ${schema}.reports r ON r.id = e.report_id
         ORDER BY e.started_at DESC LIMIT 6`,
      ),
      this.db.$queryRawUnsafe(
        `SELECT report_type, COUNT(*)::int AS count
         FROM ${schema}.reports GROUP BY report_type ORDER BY count DESC LIMIT 5`,
      ),
      this.db.$queryRawUnsafe(
        `SELECT s.id, r.name, s.frequency, s.next_run_at, s.export_format
         FROM ${schema}.scheduled_reports s
         JOIN ${schema}.reports r ON r.id = s.report_id
         WHERE s.status = 'active' ORDER BY s.next_run_at ASC LIMIT 6`,
      ),
    ]);
    return {
      totalGenerated: Number(counts[0]?.generated ?? 0),
      scheduledCount: Number(counts[0]?.scheduled ?? 0),
      savedCount: Number(counts[0]?.saved ?? 0),
      recent,
      mostUsedTemplates: used,
      upcoming,
    };
  }

  async list(ctx: TenantContext) {
    await this.ensureStore(ctx);
    return this.db.$queryRawUnsafe(
      `SELECT * FROM ${this.tenant.quote(ctx.schemaName)}.reports
       ORDER BY updated_at DESC`,
    );
  }

  async save(ctx: TenantContext, userId: string, dto: GenerateReportDto) {
    await this.ensureStore(ctx);
    const schema = this.tenant.quote(ctx.schemaName);
    const rows = await this.db.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO ${schema}.reports
       (name, report_type, configuration_json, created_by)
       VALUES ($1, $2, $3::jsonb, $4::uuid) RETURNING id`,
      dto.name,
      dto.reportType,
      JSON.stringify(dto.configuration),
      userId,
    );
    await this.audit(ctx, userId, 'reports.create', 'report', rows[0].id, {
      name: dto.name,
      reportType: dto.reportType,
    });
    return { id: rows[0].id, ...(await this.generate(ctx, dto)) };
  }

  async update(
    ctx: TenantContext,
    userId: string,
    id: string,
    dto: UpdateReportDto,
  ) {
    await this.ensureStore(ctx);
    const schema = this.tenant.quote(ctx.schemaName);
    const result = await this.db.$executeRawUnsafe(
      `UPDATE ${schema}.reports SET
       name = COALESCE($2, name),
       configuration_json = COALESCE($3::jsonb, configuration_json),
       updated_at = now()
       WHERE id = $1::uuid`,
      id,
      dto.name ?? null,
      dto.configuration ? JSON.stringify(dto.configuration) : null,
    );
    if (!result) throw new NotFoundException('Report not found');
    await this.audit(ctx, userId, 'reports.update', 'report', id, dto);
    return { updated: true };
  }

  async remove(ctx: TenantContext, userId: string, id: string) {
    await this.ensureStore(ctx);
    const result = await this.db.$executeRawUnsafe(
      `DELETE FROM ${this.tenant.quote(ctx.schemaName)}.reports WHERE id = $1::uuid`,
      id,
    );
    if (!result) throw new NotFoundException('Report not found');
    await this.audit(ctx, userId, 'reports.delete', 'report', id);
    return { deleted: true };
  }

  async generate(ctx: TenantContext, dto: GenerateReportDto) {
    const rows = await this.loadRows(ctx, dto.reportType, dto.configuration);
    const columns = this.columns(dto.reportType, dto.configuration, rows);
    const selected = rows.map((row) => ({
      ...(dto.reportType === 'balance_sheet'
        ? {
            type: row.type,
            level: row.level,
            is_leaf: row.is_leaf,
            parent_id: row.parent_id,
          }
        : {}),
      ...Object.fromEntries(columns.map((column) => [column.key, row[column.key]])),
    }));
    const grouped = this.groupRows(selected, dto.configuration, columns, dto.reportType);
    const outputColumns = grouped !== selected && grouped.length
      ? Object.keys(grouped[0]).map((key) =>
          columns.find((column) => column.key === key) ?? { key, label: this.label(key) },
        )
      : columns;
    const sorted = this.sortRows(grouped, dto.configuration);
    const totals = this.totals(sorted, outputColumns);
    return {
      title: dto.name,
      reportType: dto.reportType,
      generatedAt: new Date().toISOString(),
      filters: {
        datePreset: dto.configuration.datePreset,
        dateFrom: dto.configuration.dateFrom,
        dateTo: dto.configuration.dateTo,
        ...dto.configuration.filters,
      },
      columns: outputColumns,
      rows: sorted,
      totals,
    } satisfies GeneratedReport;
  }

  async exportGenerated(
    ctx: TenantContext,
    dto: GenerateReportDto,
    format: 'pdf' | 'xlsx' | 'csv' = 'pdf',
  ) {
    return this.exportFile(await this.generate(ctx, dto), format);
  }

  async exportSaved(
    ctx: TenantContext,
    id: string,
    format: 'pdf' | 'xlsx' | 'csv' = 'pdf',
  ) {
    const report = await this.getSaved(ctx, id);
    return this.exportGenerated(
      ctx,
      {
        name: report.name,
        reportType: report.report_type,
        configuration: report.configuration_json,
      },
      format,
    );
  }

  async listSchedules(ctx: TenantContext) {
    await this.ensureStore(ctx);
    const schema = this.tenant.quote(ctx.schemaName);
    return this.db.$queryRawUnsafe(
      `SELECT s.*, r.name AS report_name, r.report_type
       FROM ${schema}.scheduled_reports s
       JOIN ${schema}.reports r ON r.id = s.report_id
       ORDER BY s.created_at DESC`,
    );
  }

  async createSchedule(
    ctx: TenantContext,
    userId: string,
    dto: CreateScheduleDto,
  ) {
    await this.ensureStore(ctx);
    await this.getSaved(ctx, dto.reportId);
    const schema = this.tenant.quote(ctx.schemaName);
    const nextRun = this.initialRun(dto.startDate, dto.timeOfDay, dto.timezone);
    const rows = await this.db.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO ${schema}.scheduled_reports
       (report_id, frequency, timezone, start_date, end_date, time_of_day,
        next_run_at, recipients_json, delivery_methods, export_format, created_by)
       VALUES ($1::uuid, $2, $3, $4::date, $5::date, $6::time, $7::timestamptz,
        $8::jsonb, $9::jsonb, $10, $11::uuid) RETURNING id`,
      dto.reportId,
      dto.frequency,
      dto.timezone,
      dto.startDate,
      dto.endDate ?? null,
      dto.timeOfDay,
      nextRun.toISOString(),
      JSON.stringify(dto.recipients),
      JSON.stringify(dto.deliveryMethods),
      dto.exportFormat,
      userId,
    );
    await this.audit(ctx, userId, 'reports.schedule', 'scheduled_report', rows[0].id);
    return { id: rows[0].id, nextRunAt: nextRun };
  }

  async updateSchedule(
    ctx: TenantContext,
    userId: string,
    id: string,
    dto: UpdateScheduleDto,
  ) {
    await this.ensureStore(ctx);
    const schema = this.tenant.quote(ctx.schemaName);
    const result = await this.db.$executeRawUnsafe(
      `UPDATE ${schema}.scheduled_reports SET
       status = COALESCE($2, status),
       frequency = COALESCE($3, frequency),
       timezone = COALESCE($4, timezone),
       time_of_day = COALESCE($5::time, time_of_day),
       recipients_json = COALESCE($6::jsonb, recipients_json),
       delivery_methods = COALESCE($7::jsonb, delivery_methods),
       export_format = COALESCE($8, export_format),
       updated_at = now()
       WHERE id = $1::uuid`,
      id,
      dto.status ?? null,
      dto.frequency ?? null,
      dto.timezone ?? null,
      dto.timeOfDay ?? null,
      dto.recipients ? JSON.stringify(dto.recipients) : null,
      dto.deliveryMethods ? JSON.stringify(dto.deliveryMethods) : null,
      dto.exportFormat ?? null,
    );
    if (!result) throw new NotFoundException('Schedule not found');
    await this.audit(ctx, userId, 'reports.schedule.update', 'scheduled_report', id, dto);
    return { updated: true };
  }

  async removeSchedule(ctx: TenantContext, userId: string, id: string) {
    const result = await this.db.$executeRawUnsafe(
      `DELETE FROM ${this.tenant.quote(ctx.schemaName)}.scheduled_reports
       WHERE id = $1::uuid`,
      id,
    );
    if (!result) throw new NotFoundException('Schedule not found');
    await this.audit(ctx, userId, 'reports.schedule.delete', 'scheduled_report', id);
    return { deleted: true };
  }

  async runSchedule(ctx: TenantContext, id: string) {
    await this.ensureStore(ctx);
    const schema = this.tenant.quote(ctx.schemaName);
    const schedules = await this.db.$queryRawUnsafe<
      Array<{
        id: string;
        report_id: string;
        frequency: string;
        export_format: 'pdf' | 'xlsx' | 'csv';
        created_by: string;
        delivery_methods: string[];
        recipients_json: string[];
        timezone: string;
        next_run_at: Date;
        time_of_day: string;
      }>
    >(
      `SELECT * FROM ${schema}.scheduled_reports WHERE id = $1::uuid`,
      id,
    );
    if (!schedules[0]) throw new NotFoundException('Schedule not found');
    const schedule = schedules[0];
    const execution = await this.db.$queryRawUnsafe<Array<{ id: string }>>(
      `INSERT INTO ${schema}.report_executions
       (report_id, scheduled_report_id, status, export_format)
       VALUES ($1::uuid, $2::uuid, 'running', $3) RETURNING id`,
      schedule.report_id,
      id,
      schedule.export_format,
    );
    try {
      const saved = await this.getSaved(ctx, schedule.report_id);
      const generated = await this.generate(ctx, {
        name: saved.name,
        reportType: saved.report_type,
        configuration: saved.configuration_json,
      });
      const file = await this.exportFile(generated, schedule.export_format);
      const fileUrl = `/tenant/reports/executions/${execution[0].id}/download`;
      await this.db.$executeRawUnsafe(
        `UPDATE ${schema}.report_executions SET
         file_url = $2, file_name = $3, content_type = $4, file_data = $5,
         result_json = $6::jsonb, email_status = $7
         WHERE id = $1::uuid`,
        execution[0].id,
        fileUrl,
        file.fileName,
        file.contentType,
        file.buffer,
        JSON.stringify(generated),
        schedule.delivery_methods?.includes('email') ? 'pending' : 'not_requested',
      );

      if (schedule.delivery_methods?.includes('email')) {
        const emailFile = schedule.export_format === 'pdf'
          ? file
          : await this.exportFile(generated, 'pdf');
        await this.sendReportEmail(
          schedule.recipients_json ?? [],
          saved.name,
          emailFile,
        );
      }
      await this.db.$executeRawUnsafe(
        `UPDATE ${schema}.report_executions SET
         completed_at = now(), status = 'completed',
         email_status = CASE WHEN email_status = 'pending' THEN 'sent' ELSE email_status END,
         emailed_at = CASE WHEN email_status = 'pending' THEN now() ELSE emailed_at END
         WHERE id = $1::uuid`,
        execution[0].id,
      );
      await this.db.$executeRawUnsafe(
        `UPDATE ${schema}.scheduled_reports SET
         last_run_at = now(), next_run_at = $2::timestamptz, updated_at = now()
         WHERE id = $1::uuid`,
        id,
        this.nextRun(
          new Date(schedule.next_run_at),
          schedule.frequency,
          schedule.timezone,
        ).toISOString(),
      );
      if (schedule.delivery_methods?.includes('in_app')) {
        await this.db.$executeRawUnsafe(
          `INSERT INTO ${schema}.alerts
           (type, severity, title, message, entity_type, entity_id)
           VALUES ('report_ready', 'info', $1, $2, 'report_execution', $3::uuid)`,
          `${saved.name} is ready`,
          `Scheduled report completed successfully in ${schedule.export_format.toUpperCase()} format.`,
          execution[0].id,
        );
      }
      await this.audit(
        ctx,
        schedule.created_by,
        'reports.execute',
        'report_execution',
        execution[0].id,
      );
      return { executionId: execution[0].id, status: 'completed', fileUrl };
    } catch (error) {
      await this.db.$executeRawUnsafe(
        `UPDATE ${schema}.report_executions SET
         completed_at = now(), status = 'failed',
         email_status = CASE WHEN email_status = 'pending' THEN 'failed' ELSE email_status END,
         error_message = $2
         WHERE id = $1::uuid`,
        execution[0].id,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async executions(ctx: TenantContext) {
    await this.ensureStore(ctx);
    const schema = this.tenant.quote(ctx.schemaName);
    return this.db.$queryRawUnsafe(
      `SELECT e.id, e.status, e.started_at, e.completed_at, e.file_url,
        e.file_name, e.content_type, e.export_format, e.email_status,
        e.emailed_at, e.error_message, r.name AS report_name,
        s.frequency, s.recipients_json
       FROM ${schema}.report_executions e
       LEFT JOIN ${schema}.reports r ON r.id = e.report_id
       LEFT JOIN ${schema}.scheduled_reports s ON s.id = e.scheduled_report_id
       ORDER BY e.started_at DESC LIMIT 100`,
    );
  }

  async executionFile(ctx: TenantContext, id: string) {
    await this.ensureStore(ctx);
    const rows = await this.db.$queryRawUnsafe<Array<{
      file_name: string | null;
      content_type: string | null;
      file_data: Buffer | null;
    }>>(
      `SELECT file_name, content_type, file_data
       FROM ${this.tenant.quote(ctx.schemaName)}.report_executions
       WHERE id = $1::uuid`,
      id,
    );
    if (!rows[0]?.file_data) throw new NotFoundException('Generated report file not found');
    return {
      fileName: rows[0].file_name ?? 'scheduled-report.pdf',
      contentType: rows[0].content_type ?? 'application/octet-stream',
      buffer: rows[0].file_data,
    };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async runDueSchedules() {
    const organizations = await this.db.organization.findMany({
      where: { isActive: true },
      select: { id: true, schemaName: true },
    });
    for (const organization of organizations) {
      const subscription = await this.tenant.subscriptionForOrganization(organization.id);
      if (!this.tenant.featureMap(subscription?.plan.features).scheduledReports) continue;
      const ctx: TenantContext = {
        organizationId: organization.id,
        schemaName: organization.schemaName,
        role: 'system',
      };
      try {
        await this.ensureStore(ctx);
        const due = await this.db.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM ${this.tenant.quote(ctx.schemaName)}.scheduled_reports
           WHERE status = 'active' AND next_run_at <= now()
             AND (end_date IS NULL OR end_date >= CURRENT_DATE)
           ORDER BY next_run_at LIMIT 10`,
        );
        for (const schedule of due) {
          await this.runSchedule(ctx, schedule.id);
        }
      } catch (error) {
        this.logger.error(
          `Scheduled report scan failed for ${organization.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }

  private async getSaved(ctx: TenantContext, id: string) {
    await this.ensureStore(ctx);
    const rows = await this.db.$queryRawUnsafe<
      Array<{
        id: string;
        name: string;
        report_type: ReportType;
        configuration_json: ReportConfigurationDto;
      }>
    >(
      `SELECT id, name, report_type, configuration_json
       FROM ${this.tenant.quote(ctx.schemaName)}.reports WHERE id = $1::uuid`,
      id,
    );
    if (!rows[0]) throw new NotFoundException('Report not found');
    return rows[0];
  }

  private async loadRows(
    ctx: TenantContext,
    type: ReportType,
    configuration: ReportConfigurationDto,
  ): Promise<ReportRow[]> {
    const schema = this.tenant.quote(ctx.schemaName);
    let rows: ReportRow[];
    switch (type) {
      case 'profit_loss':
        rows = await this.db.$queryRawUnsafe(
          `SELECT a.code, a.name AS account, a.type,
           SUM(CASE WHEN a.type = 'Revenue' THEN jl.credit - jl.debit
                    ELSE jl.debit - jl.credit END)::numeric AS amount
           FROM ${schema}.accounts a
           JOIN ${schema}.journal_lines jl ON jl.account_id = a.id
           JOIN ${schema}.journal_entries je ON je.id = jl.journal_entry_id
           WHERE a.type IN ('Revenue', 'Expense')
           GROUP BY a.id ORDER BY a.type DESC, a.code`,
        );
        break;
      case 'balance_sheet':
        rows = await this.db.$queryRawUnsafe(
          `WITH RECURSIVE account_tree AS (
             SELECT a.id AS root_id, a.id AS descendant_id
             FROM ${schema}.accounts a
             WHERE a.type IN ('Asset','Liability','Equity')
             UNION ALL
             SELECT tree.root_id, child.id
             FROM account_tree tree
             JOIN ${schema}.accounts child ON child.parent_id = tree.descendant_id
           ),
           account_balances AS (
             SELECT a.id,
               COALESCE(SUM(
                 CASE WHEN a.type IN ('Liability','Equity')
                   THEN jl.credit - jl.debit
                   ELSE jl.debit - jl.credit
                 END
               ), 0)::numeric AS balance
             FROM ${schema}.accounts a
             LEFT JOIN ${schema}.journal_lines jl ON jl.account_id = a.id
             GROUP BY a.id
           ),
           balance_rows AS (
             SELECT a.parent_id::text AS parent_id, a.code, a.name AS account,
               a.type, a.level, a.is_leaf,
               COALESCE(SUM(b.balance), 0)::numeric AS balance
             FROM ${schema}.accounts a
             JOIN account_tree tree ON tree.root_id = a.id
             JOIN account_balances b ON b.id = tree.descendant_id
             WHERE a.type IN ('Asset','Liability','Equity')
             GROUP BY a.id
           ),
           nominal_totals AS (
             SELECT
               COALESCE(SUM(CASE WHEN a.type = 'Revenue' THEN jl.credit - jl.debit ELSE 0 END), 0)::numeric AS revenue,
               COALESCE(SUM(CASE WHEN a.type = 'Expense' THEN jl.debit - jl.credit ELSE 0 END), 0)::numeric AS expenses
             FROM ${schema}.accounts a
             LEFT JOIN ${schema}.journal_lines jl ON jl.account_id = a.id
             WHERE a.type IN ('Revenue','Expense')
           )
           SELECT parent_id, code, account, type, level, is_leaf, balance
           FROM (
             SELECT * FROM balance_rows
             UNION ALL
             SELECT NULL::text, '3990', 'Current Earnings', 'Equity', 1, false,
               revenue - expenses FROM nominal_totals
             UNION ALL
             SELECT '3990', '3991', 'Revenue', 'Equity', 2, true,
               revenue FROM nominal_totals
             UNION ALL
             SELECT '3990', '3992', 'Expenses', 'Equity', 2, true,
               -expenses FROM nominal_totals
           ) report_rows
           ORDER BY CASE type WHEN 'Asset' THEN 1 WHEN 'Liability' THEN 2 ELSE 3 END,
             code`,
        );
        break;
      case 'cash_flow':
        rows = await this.db.$queryRawUnsafe(
          `SELECT to_char(date_trunc('month', je.date), 'YYYY-MM') AS month,
           COALESCE(je.reference_type, 'manual') AS activity,
           SUM(jl.debit - jl.credit)::numeric AS net_cash_flow
           FROM ${schema}.journal_lines jl
           JOIN ${schema}.journal_entries je ON je.id = jl.journal_entry_id
           JOIN ${schema}.accounts a ON a.id = jl.account_id
           WHERE a.code IN ('1130', '1140', '1150')
           GROUP BY 1, 2 ORDER BY 1`,
        );
        break;
      case 'accounts_receivable':
        rows = await this.db.$queryRawUnsafe(
          `SELECT i.invoice_number, c.name AS customer_name, i.issue_date,
           i.due_date, i.total, COALESCE(SUM(p.amount), 0)::numeric AS paid,
           (i.total - COALESCE(SUM(p.amount), 0))::numeric AS balance, i.status
           FROM ${schema}.invoices i
           JOIN ${schema}.customers c ON c.id = i.customer_id
           LEFT JOIN ${schema}.customer_payments p ON p.invoice_id = i.id
           WHERE i.status IN ('unpaid','partial')
           GROUP BY i.id, c.name ORDER BY i.due_date`,
        );
        break;
      case 'accounts_payable':
        rows = await this.db.$queryRawUnsafe(
          `SELECT b.bill_number, v.name AS vendor_name, b.issue_date,
           b.due_date, b.total, COALESCE(SUM(p.amount), 0)::numeric AS paid,
           (b.total - COALESCE(SUM(p.amount), 0))::numeric AS balance, b.status
           FROM ${schema}.vendor_bills b
           JOIN ${schema}.vendors v ON v.id = b.vendor_id
           LEFT JOIN ${schema}.vendor_payments p ON p.vendor_bill_id = b.id
           WHERE b.type = 'purchase' AND b.status IN ('received','partial')
           GROUP BY b.id, v.name ORDER BY b.due_date`,
        );
        break;
      case 'expense':
        rows = await this.expenseRows(schema);
        break;
      case 'vendor_payments':
        rows = await this.db.$queryRawUnsafe(
          `SELECT p.reference, v.name AS vendor_name, b.bill_number,
           p.amount, p.payment_date, p.payment_method, p.notes, p.created_at
           FROM ${schema}.vendor_payments p
           JOIN ${schema}.vendors v ON v.id = p.vendor_id
           JOIN ${schema}.vendor_bills b ON b.id = p.vendor_bill_id
           WHERE b.type = 'purchase'
           ORDER BY p.payment_date DESC`,
        );
        break;
      case 'tax':
        rows = await this.db.$queryRawUnsafe(
          `SELECT 'sales_tax' AS tax_type, i.invoice_number AS reference,
           c.name AS party, i.issue_date AS date, i.tax_amount, i.total
           FROM ${schema}.invoices i JOIN ${schema}.customers c ON c.id = i.customer_id
           UNION ALL
           SELECT 'input_tax', b.bill_number, v.name, b.issue_date, b.tax_amount, b.total
           FROM ${schema}.vendor_bills b LEFT JOIN ${schema}.vendors v ON v.id = b.vendor_id
           ORDER BY date DESC`,
        );
        break;
      case 'custom':
        rows = await this.customRows(schema, configuration.source ?? 'invoices');
        break;
      case 'revenue':
      case 'sales':
      case 'customer_invoices':
      default:
        rows = await this.invoiceRows(schema);
        break;
    }
    return this.applyFilters(this.serialize(rows), configuration);
  }

  private invoiceRows(schema: string) {
    return this.db.$queryRawUnsafe<ReportRow[]>(
      `SELECT i.invoice_number, c.name AS customer_name, i.issue_date,
       i.due_date, i.subtotal, i.tax_amount, i.total, i.status, i.created_at
       FROM ${schema}.invoices i JOIN ${schema}.customers c ON c.id = i.customer_id
       ORDER BY i.issue_date DESC`,
    );
  }

  private expenseRows(schema: string) {
    return this.db.$queryRawUnsafe<ReportRow[]>(
      `SELECT b.bill_number, b.type AS bill_type,
       COALESCE(v.name, 'No vendor') AS vendor_name,
       COALESCE(string_agg(bl.description, ', ' ORDER BY bl.line_number), '') AS description,
       a.name AS account_name, b.issue_date, b.due_date, b.subtotal,
       b.tax_amount, b.total, b.status,
       COALESCE((SELECT SUM(vp.amount) FROM ${schema}.vendor_payments vp
                 WHERE vp.vendor_bill_id = b.id), 0)::numeric AS paid_amount,
       b.created_at
       FROM ${schema}.vendor_bills b
       LEFT JOIN ${schema}.vendors v ON v.id = b.vendor_id
       LEFT JOIN ${schema}.vendor_bill_lines bl ON bl.vendor_bill_id = b.id
       LEFT JOIN ${schema}.accounts a ON a.id = b.account_id
       GROUP BY b.id, v.name, a.name
       ORDER BY b.issue_date DESC`,
    );
  }

  private customRows(schema: string, source: string) {
    if (source === 'expenses') return this.expenseRows(schema);
    if (source === 'payments') {
      return this.db.$queryRawUnsafe<ReportRow[]>(
        `SELECT p.reference, c.name AS party_name, p.amount, p.payment_date,
         p.payment_method, p.notes, p.created_at
         FROM ${schema}.customer_payments p
         JOIN ${schema}.customers c ON c.id = p.customer_id
         ORDER BY p.payment_date DESC`,
      );
    }
    return this.invoiceRows(schema);
  }

  private applyFilters(rows: ReportRow[], config: ReportConfigurationDto) {
    const range = this.dateRange(config);
    return rows.filter((row) => {
      const dateValue = row.issue_date ?? row.expense_date ?? row.payment_date ?? row.date ?? row.month;
      if (range.from && dateValue && String(dateValue).slice(0, 10) < range.from) return false;
      if (range.to && dateValue && String(dateValue).slice(0, 10) > range.to) return false;
      for (const [key, value] of Object.entries(config.filters ?? {})) {
        if (value && String(row[key] ?? '').toLowerCase() !== value.toLowerCase()) return false;
      }
      return true;
    });
  }

  private dateRange(config: ReportConfigurationDto) {
    if (config.dateFrom || config.dateTo) return { from: config.dateFrom, to: config.dateTo };
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    const start = new Date(now);
    switch (config.datePreset) {
      case 'today':
        return { from: end, to: end };
      case 'yesterday':
        start.setDate(start.getDate() - 1);
        return { from: start.toISOString().slice(0, 10), to: start.toISOString().slice(0, 10) };
      case 'this_week':
        start.setDate(start.getDate() - start.getDay());
        break;
      case 'this_quarter':
        start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1);
        break;
      case 'this_year':
        start.setMonth(0, 1);
        break;
      case 'this_month':
      default:
        start.setDate(1);
    }
    return { from: start.toISOString().slice(0, 10), to: end };
  }

  private columns(type: ReportType, config: ReportConfigurationDto, rows: ReportRow[]): Column[] {
    if (type === 'balance_sheet') {
      return [
        { key: 'code', label: 'Code' },
        { key: 'account', label: 'Account' },
        { key: 'balance', label: 'Balance' },
      ];
    }
    if (type === 'custom') {
      const allowed = new Map((CUSTOM_FIELDS[config.source ?? 'invoices'] ?? []).map((item) => [item.key, item.label]));
      const requested = config.fields?.length
        ? config.fields.filter((field) => allowed.has(field.key))
        : Array.from(allowed, ([key, label]) => ({ key, label }));
      return requested.map((field) => ({
        key: field.key,
        label: field.label || allowed.get(field.key) || this.label(field.key),
      }));
    }
    return Object.keys(rows[0] ?? {}).map((key) => ({ key, label: this.label(key) }));
  }

  private sortRows(rows: ReportRow[], config: ReportConfigurationDto) {
    if (!config.sortBy) return rows;
    const direction = config.sortDirection === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) =>
      String(a[config.sortBy!] ?? '').localeCompare(String(b[config.sortBy!] ?? ''), undefined, { numeric: true }) * direction,
    );
  }

  private groupRows(
    rows: ReportRow[],
    config: ReportConfigurationDto,
    columns: Column[],
    reportType: ReportType,
  ) {
    if (!config.groupBy || !config.aggregation) return rows;
    if (!(GROUP_FIELDS[reportType] ?? []).includes(config.groupBy)) return rows;
    const measureKey = (AGGREGATION_FIELDS[reportType] ?? [])
      .find((key) => columns.some((column) => column.key === key)
        && rows.some((row) => row[key] !== null && row[key] !== undefined && Number.isFinite(Number(row[key]))));
    if (!measureKey && config.aggregation !== 'count') return rows;
    const outputKey = config.aggregation === 'count' ? 'count' : measureKey!;
    const groups = new Map<string, number[]>();
    for (const row of rows) {
      const group = this.groupValue(row, config.groupBy);
      const values = groups.get(group) ?? [];
      values.push(measureKey ? Number(row[measureKey] ?? 0) : 1);
      groups.set(group, values);
    }
    return Array.from(groups, ([group, values]) => ({
      [config.groupBy!]: group,
      [outputKey]: this.aggregate(values, config.aggregation!),
    }));
  }

  private groupValue(row: ReportRow, groupBy: string) {
    if (!['month', 'quarter', 'year'].includes(groupBy)) {
      return String(row[groupBy] ?? 'Unspecified');
    }
    const raw = row.issue_date ?? row.expense_date ?? row.payment_date ?? row.date ?? row.month;
    if (!raw) return 'Unspecified';
    const date = new Date(String(raw).length === 7 ? `${raw}-01` : String(raw));
    if (Number.isNaN(date.getTime())) return String(raw);
    const year = date.getUTCFullYear();
    if (groupBy === 'year') return String(year);
    if (groupBy === 'quarter') return `${year} Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
    return `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private aggregate(values: number[], operation: string) {
    if (operation === 'count') return values.length;
    if (operation === 'average') return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    if (operation === 'min') return Math.min(...values);
    if (operation === 'max') return Math.max(...values);
    return values.reduce((sum, value) => sum + value, 0);
  }

  private totals(rows: ReportRow[], columns: Column[]) {
    return Object.fromEntries(
      columns
        .filter((column) => rows.some((row) => typeof row[column.key] === 'number'))
        .map((column) => [
          column.key,
          rows.reduce((sum, row) => sum + Number(row[column.key] ?? 0), 0),
        ]),
    );
  }

  private async exportFile(report: GeneratedReport, format: 'pdf' | 'xlsx' | 'csv') {
    const baseName = this.slug(report.title);
    if (format === 'csv') {
      return {
        fileName: `${baseName}.csv`,
        contentType: 'text/csv; charset=utf-8',
        buffer: Buffer.from(this.csv(report)),
      };
    }
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Report');
      sheet.addRow([report.title]);
      sheet.addRow([`Generated: ${report.generatedAt}`]);
      sheet.addRow([`Filters: ${JSON.stringify(report.filters)}`]);
      sheet.addRow([]);
      sheet.addRow(report.columns.map((column) => column.label));
      for (const row of report.rows) {
        sheet.addRow(report.columns.map((column) => row[column.key] ?? ''));
      }
      sheet.getRow(1).font = { bold: true, size: 16 };
      sheet.getRow(5).font = { bold: true };
      sheet.columns.forEach((column) => { column.width = 20; });
      return {
        fileName: `${baseName}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from(await workbook.xlsx.writeBuffer()),
      };
    }
    return {
      fileName: `${baseName}.pdf`,
      contentType: 'application/pdf',
      buffer: await this.pdf(report),
    };
  }

  private csv(report: GeneratedReport) {
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    return [
      report.columns.map((column) => escape(column.label)).join(','),
      ...report.rows.map((row) => report.columns.map((column) => escape(row[column.key])).join(',')),
    ].join('\r\n');
  }

  private pdf(report: GeneratedReport): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const document = new PDFDocument({ size: 'A4', margin: 36 });
      const chunks: Buffer[] = [];
      document.on('data', (chunk: Buffer) => chunks.push(chunk));
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
      document.font('Helvetica-Bold').fontSize(18).text(report.title);
      document.font('Helvetica').fontSize(9).text(`Generated: ${report.generatedAt}`);
      document.text(`Filters: ${JSON.stringify(report.filters)}`).moveDown();

      if (report.reportType === 'balance_sheet') {
        this.drawBalanceSheet(document, report);
        document.end();
        return;
      }

      const tableX = document.page.margins.left;
      const tableWidth = document.page.width - document.page.margins.left - document.page.margins.right;
      const widths = report.columns.map(() => tableWidth / Math.max(1, report.columns.length));
      const drawRow = (values: unknown[], bold = false) => {
        let height = 18;
        values.forEach((value, index) => {
          const text = String(value ?? '');
          height = Math.max(height, document.heightOfString(text, { width: widths[index] - 6 }) + 6);
        });
        if (document.y + height > document.page.height - document.page.margins.bottom) {
          document.addPage();
          document.x = tableX;
          document.y = document.page.margins.top;
          if (!bold) drawRow(report.columns.map((column) => column.label), true);
        }
        const rowY = document.y;
        values.forEach((value, index) => {
          const x = tableX + widths.slice(0, index).reduce((sum, width) => sum + width, 0);
          document.rect(x, rowY, widths[index], height).strokeColor('#cccccc').stroke();
          document.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(7)
            .text(String(value ?? ''), x + 3, rowY + 3, {
              width: widths[index] - 6,
              height: height - 6,
              lineBreak: false,
            });
        });
        document.x = tableX;
        document.y = rowY + height;
      };
      drawRow(report.columns.map((column) => column.label), true);
      report.rows.forEach((row) => drawRow(report.columns.map((column) => row[column.key])));
      document.end();
    });
  }

  private drawBalanceSheet(document: PDFKit.PDFDocument, report: GeneratedReport) {
    const sections = [
      { type: 'Asset', title: 'ASSETS' },
      { type: 'Liability', title: 'LIABILITIES' },
      { type: 'Equity', title: "OWNER'S EQUITY" },
    ];
    const money = (value: unknown) =>
      Number(value ?? 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    const left = document.page.margins.left;
    const right = document.page.margins.right;
    const pageWidth = document.page.width - left - right;

    for (const [index, section] of sections.entries()) {
      if (index > 0) document.addPage();
      const rows = report.rows.filter((row) => row.type === section.type);
      const headerY = document.y;
      document.rect(left, headerY, pageWidth, 34).fill('#b9def5');
      document.fillColor('#111111').font('Helvetica-Bold').fontSize(16)
        .text(section.title, left + 12, headerY + 9, { lineBreak: false });
      document.y = headerY + 46;

      for (const row of rows) {
        if (document.y > document.page.height - 65) {
          document.addPage();
          document.font('Helvetica-Bold').fontSize(12).text(section.title);
          document.moveDown(0.5);
        }
        const level = Math.max(1, Number(row.level ?? 1));
        const isParent = row.is_leaf === false;
        const y = document.y;
        const indent = (level - 1) * 18;
        document.font(isParent ? 'Helvetica-Bold' : 'Helvetica').fontSize(isParent ? 10 : 9);
        document.text(String(row.account ?? ''), left + 10 + indent, y, {
          width: pageWidth - 150 - indent,
          lineBreak: false,
        });
        document.text(money(row.balance), document.page.width - right - 120, y, {
          width: 110,
          align: 'right',
          lineBreak: false,
        });
        document.y = y + 22;
        if (isParent) {
          document.moveTo(left + 10, document.y - 3)
            .lineTo(document.page.width - right - 10, document.y - 3)
            .strokeColor('#d6d6d6').stroke();
        }
      }

      const total = rows
        .filter((row) => Number(row.level ?? 1) === 1)
        .reduce((sum, row) => sum + Number(row.balance ?? 0), 0);
      const totalY = document.y + 6;
      document.rect(left, totalY, pageWidth, 30).fill('#b9def5');
      document.fillColor('#111111').font('Helvetica-Bold').fontSize(12)
        .text(`TOTAL ${section.title}`, left + 10, totalY + 8, { lineBreak: false });
      document.text(money(total), document.page.width - right - 130, totalY + 8, {
        width: 120,
        align: 'right',
        lineBreak: false,
      });
      document.y = totalY + 40;
    }
  }

  private serialize(rows: ReportRow[]) {
    return rows.map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          typeof value === 'bigint'
            ? Number(value)
            : value instanceof Date
              ? value.toISOString()
              : this.numeric(value),
        ]),
      ),
    );
  }

  private numeric(value: unknown) {
    if (typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    return value;
  }

  private label(key: string) {
    return key.replaceAll('_', ' ').replace(/\b\w/g, (value) => value.toUpperCase());
  }

  private slug(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'report';
  }

  private initialRun(startDate: string, timeOfDay: string, timezone: string) {
    const candidate = this.zonedDateTimeToUtc(startDate, timeOfDay || '09:00', timezone);
    return candidate > new Date() ? candidate : new Date();
  }

  private nextRun(from: Date, frequency: string, timezone: string) {
    const local = this.localDateParts(from, timezone);
    const value = new Date(Date.UTC(local.year, local.month - 1, local.day));
    if (frequency === 'daily') value.setUTCDate(value.getUTCDate() + 1);
    else if (frequency === 'weekly') value.setUTCDate(value.getUTCDate() + 7);
    else if (frequency === 'monthly') value.setUTCMonth(value.getUTCMonth() + 1);
    else if (frequency === 'quarterly') value.setUTCMonth(value.getUTCMonth() + 3);
    else value.setUTCFullYear(value.getUTCFullYear() + 1);
    return this.zonedDateTimeToUtc(
      value.toISOString().slice(0, 10),
      `${String(local.hour).padStart(2, '0')}:${String(local.minute).padStart(2, '0')}`,
      timezone,
    );
  }

  private zonedDateTimeToUtc(date: string, time: string, timezone: string) {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const target = Date.UTC(year, month - 1, day, hour, minute);
    let candidate = new Date(target);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const local = this.localDateParts(candidate, timezone);
      const represented = Date.UTC(
        local.year,
        local.month - 1,
        local.day,
        local.hour,
        local.minute,
      );
      candidate = new Date(candidate.getTime() + target - represented);
    }
    return candidate;
  }

  private localDateParts(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(date);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? 0);
    return {
      year: value('year'),
      month: value('month'),
      day: value('day'),
      hour: value('hour'),
      minute: value('minute'),
    };
  }

  private async sendReportEmail(
    recipients: string[],
    reportName: string,
    file: { fileName: string; contentType: string; buffer: Buffer },
  ) {
    const to = recipients.map((recipient) => recipient.trim()).filter(Boolean);
    if (!to.length) throw new BadRequestException('Scheduled email has no recipients');
    const user = process.env.GOOGLE_EMAIL;
    const pass = process.env.GOOGLE_APP_PASSWORD;
    if (!user || !pass) {
      throw new BadRequestException(
        'Scheduled report email is not configured. Set GOOGLE_EMAIL and GOOGLE_APP_PASSWORD.',
      );
    }
    const boundary = `hesbtak-${Date.now().toString(36)}`;
    const attachment = file.buffer.toString('base64').match(/.{1,76}/g)?.join('\r\n') ?? '';
    const message = [
      `From: Hesbtak AI <${user}>`,
      `To: ${to.join(', ')}`,
      `Subject: Scheduled report: ${reportName}`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      '',
      `Your scheduled report "${reportName}" is attached as a PDF.`,
      '',
      `--${boundary}`,
      `Content-Type: ${file.contentType}; name="${file.fileName}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${file.fileName}"`,
      '',
      attachment,
      `--${boundary}--`,
    ].join('\r\n');
    await this.smtpSend({
      host: 'smtp.gmail.com',
      port: 465,
      user,
      pass,
      recipients: to,
      message,
      rejectUnauthorized: process.env.GOOGLE_SMTP_REJECT_UNAUTHORIZED !== 'false',
    });
  }

  private smtpSend(options: {
    host: string;
    port: number;
    user: string;
    pass: string;
    recipients: string[];
    message: string;
    rejectUnauthorized: boolean;
  }) {
    return new Promise<void>((resolve, reject) => {
      const socket = tls.connect(options.port, options.host, {
        servername: options.host,
        rejectUnauthorized: options.rejectUnauthorized,
      });
      let buffer = '';
      const waitFor = (expected: number[]) =>
        new Promise<void>((done, fail) => {
          const onData = (chunk: Buffer) => {
            buffer += chunk.toString('utf8');
            const last = buffer.split(/\r?\n/).filter(Boolean).at(-1);
            if (!last || /^\d{3}-/.test(last)) return;
            const code = Number(last.slice(0, 3));
            if (expected.includes(code)) {
              socket.off('data', onData);
              buffer = '';
              done();
            } else if (code >= 400) {
              socket.off('data', onData);
              fail(new Error(last));
            }
          };
          socket.on('data', onData);
          socket.once('error', fail);
        });
      const send = async (command: string, expected: number[]) => {
        socket.write(`${command}\r\n`);
        await waitFor(expected);
      };
      socket.once('error', reject);
      socket.once('secureConnect', async () => {
        try {
          await waitFor([220]);
          await send('EHLO hesbtak.ai', [250]);
          await send('AUTH LOGIN', [334]);
          await send(Buffer.from(options.user).toString('base64'), [334]);
          await send(Buffer.from(options.pass).toString('base64'), [235]);
          await send(`MAIL FROM:<${options.user}>`, [250]);
          for (const recipient of options.recipients) {
            await send(`RCPT TO:<${recipient}>`, [250, 251]);
          }
          await send('DATA', [354]);
          const escaped = options.message.replace(/^\./gm, '..');
          socket.write(`${escaped}\r\n.\r\n`);
          await waitFor([250]);
          await send('QUIT', [221]);
          socket.end();
          resolve();
        } catch (error) {
          socket.destroy();
          reject(error);
        }
      });
    });
  }

  private async audit(
    ctx: TenantContext,
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: unknown,
  ) {
    await this.db.auditLog.create({
      data: {
        organizationId: ctx.organizationId,
        userId,
        action,
        entityType,
        entityId,
        metadata: metadata as object | undefined,
      },
    });
  }

  private async ensureStore(ctx: TenantContext) {
    const schema = this.tenant.quote(ctx.schemaName);
    await this.db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${schema}.report_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        description TEXT,
        configuration_json JSONB NOT NULL,
        created_by UUID REFERENCES public.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS ${schema}.reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        report_type VARCHAR NOT NULL,
        configuration_json JSONB NOT NULL,
        created_by UUID NOT NULL REFERENCES public.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS ${schema}.scheduled_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID NOT NULL REFERENCES ${schema}.reports(id) ON DELETE CASCADE,
        frequency VARCHAR NOT NULL,
        timezone VARCHAR NOT NULL DEFAULT 'UTC',
        start_date DATE NOT NULL,
        end_date DATE,
        time_of_day TIME NOT NULL DEFAULT '09:00',
        next_run_at TIMESTAMPTZ NOT NULL,
        last_run_at TIMESTAMPTZ,
        status VARCHAR NOT NULL DEFAULT 'active',
        recipients_json JSONB NOT NULL DEFAULT '[]',
        delivery_methods JSONB NOT NULL DEFAULT '["in_app"]',
        export_format VARCHAR NOT NULL DEFAULT 'pdf',
        created_by UUID NOT NULL REFERENCES public.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS ${schema}.report_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID REFERENCES ${schema}.reports(id) ON DELETE SET NULL,
        scheduled_report_id UUID REFERENCES ${schema}.scheduled_reports(id) ON DELETE SET NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed_at TIMESTAMPTZ,
        status VARCHAR NOT NULL,
        file_url TEXT,
        file_name TEXT,
        content_type TEXT,
        file_data BYTEA,
        export_format VARCHAR,
        result_json JSONB,
        email_status VARCHAR,
        emailed_at TIMESTAMPTZ,
        error_message TEXT
      );
      ALTER TABLE ${schema}.report_executions
        ADD COLUMN IF NOT EXISTS file_name TEXT,
        ADD COLUMN IF NOT EXISTS content_type TEXT,
        ADD COLUMN IF NOT EXISTS file_data BYTEA,
        ADD COLUMN IF NOT EXISTS email_status VARCHAR,
        ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;
    `);
  }
}

import 'reflect-metadata';
import { REPORT_TYPES } from './dto';
import { CUSTOM_FIELDS, REPORT_TEMPLATES } from './report-templates';
import { ReportsService } from './reports.service';

describe('ReportsService database-aligned reports', () => {
  it('does not expose Budget vs Actual', () => {
    expect(REPORT_TYPES).not.toContain('budget_vs_actual');
    expect(REPORT_TEMPLATES.map((template) => template.type)).not.toContain('budget_vs_actual');
  });

  it('defines expense fields from vendor bills', () => {
    expect(CUSTOM_FIELDS.expenses.map((field) => field.key)).toEqual(
      expect.arrayContaining(['bill_number', 'bill_type', 'vendor_name', 'account_name', 'issue_date', 'total']),
    );
    expect(CUSTOM_FIELDS.expenses.map((field) => field.key)).not.toContain('expense_number');
  });

  it('loads every vendor bill type for the expense report', async () => {
    const rows = [
      { bill_number: 'BILL-1', bill_type: 'purchase', total: 100, issue_date: '2026-06-01' },
      { bill_number: 'BILL-2', bill_type: 'expense', total: 40, issue_date: '2026-06-02' },
    ];
    const query = jest.fn().mockResolvedValue(rows);
    const service = new ReportsService(
      { $queryRawUnsafe: query } as never,
      { quote: (schema: string) => `"${schema}"` } as never,
    );

    const report = await service.generate(
      { schemaName: 'tenant_test' } as never,
      {
        name: 'Expenses',
        reportType: 'expense',
        configuration: {},
      },
    );

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain('"tenant_test".vendor_bills');
    expect(sql).not.toMatch(/WHERE\s+b\.type/i);
    expect(report.rows).toHaveLength(2);
    expect(report.rows.map((row) => row.bill_type)).toEqual(['purchase', 'expense']);
  });

  it('includes revenue and expenses as current earnings in the balance sheet', async () => {
    const query = jest.fn().mockResolvedValue([
      { code: '3990', account: 'Current Earnings', type: 'Equity', level: 1, is_leaf: false, balance: 60 },
      { code: '3991', account: 'Revenue', type: 'Equity', level: 2, is_leaf: true, balance: 100 },
      { code: '3992', account: 'Expenses', type: 'Equity', level: 2, is_leaf: true, balance: -40 },
    ]);
    const service = new ReportsService(
      { $queryRawUnsafe: query } as never,
      { quote: (schema: string) => `"${schema}"` } as never,
    );

    const report = await service.generate(
      { schemaName: 'tenant_test' } as never,
      { name: 'Balance Sheet', reportType: 'balance_sheet', configuration: {} },
    );

    const sql = String(query.mock.calls[0][0]);
    expect(sql).toContain("'Current Earnings'");
    expect(sql).toContain("a.type = 'Revenue'");
    expect(sql).toContain("a.type = 'Expense'");
    expect(report.rows.find((row) => String(row.code) === '3990')?.balance).toBe(60);
  });

  it('groups expense totals by vendor using total as the measure', async () => {
    const query = jest.fn().mockResolvedValue([
      { bill_number: '1001', vendor_name: 'Vendor A', total: 40, issue_date: '2026-06-01' },
      { bill_number: '1002', vendor_name: 'Vendor A', total: 60, issue_date: '2026-06-02' },
      { bill_number: '1003', vendor_name: 'Vendor B', total: 25, issue_date: '2026-06-03' },
    ]);
    const service = new ReportsService(
      { $queryRawUnsafe: query } as never,
      { quote: (schema: string) => `"${schema}"` } as never,
    );

    const report = await service.generate(
      { schemaName: 'tenant_test' } as never,
      {
        name: 'Grouped expenses',
        reportType: 'expense',
        configuration: { groupBy: 'vendor_name', aggregation: 'sum' },
      },
    );

    expect(report.rows).toEqual([
      { vendor_name: 'Vendor A', total: 100 },
      { vendor_name: 'Vendor B', total: 25 },
    ]);
  });

  it('supports count and month grouping', async () => {
    const query = jest.fn().mockResolvedValue([
      { invoice_number: 'INV-1', customer_name: 'A', total: 10, issue_date: '2026-05-20' },
      { invoice_number: 'INV-2', customer_name: 'B', total: 20, issue_date: '2026-05-21' },
      { invoice_number: 'INV-3', customer_name: 'C', total: 30, issue_date: '2026-06-01' },
    ]);
    const service = new ReportsService(
      { $queryRawUnsafe: query } as never,
      { quote: (schema: string) => `"${schema}"` } as never,
    );

    const report = await service.generate(
      { schemaName: 'tenant_test' } as never,
      {
        name: 'Monthly invoice count',
        reportType: 'sales',
        configuration: { datePreset: 'this_year', groupBy: 'month', aggregation: 'count' },
      },
    );

    expect(report.rows).toEqual([
      { month: '2026-05', count: 2 },
      { month: '2026-06', count: 1 },
    ]);
    expect(report.columns).toEqual([
      { key: 'month', label: 'Month' },
      { key: 'count', label: 'Count' },
    ]);
  });
});

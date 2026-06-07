import { qualifyTenantTables } from './tenant-sql';
import { buildFinancialSnapshotQuery } from './financial-snapshot-query';

describe('qualifyTenantTables', () => {
  it('qualifies unqualified tenant tables after FROM and JOIN', () => {
    expect(
      qualifyTenantTables(
        'SELECT v.name FROM vendors v JOIN vendor_bills b ON b.vendor_id = v.id LIMIT 10',
        'tenant_1234_abcd',
      ),
    ).toBe(
      'SELECT v.name FROM "tenant_1234_abcd"."vendors" v JOIN "tenant_1234_abcd"."vendor_bills" b ON b.vendor_id = v.id LIMIT 10',
    );
  });

  it('keeps already-qualified tenant tables unchanged', () => {
    const sql =
      'SELECT name FROM "tenant_1234_abcd"."vendors" ORDER BY name LIMIT 10';

    expect(qualifyTenantTables(sql, 'tenant_1234_abcd')).toBe(sql);
  });
});

describe('buildFinancialSnapshotQuery', () => {
  it('uses the tenant schema and case-correct accounting types', () => {
    const sql = buildFinancialSnapshotQuery(
      'Show cash, receivables, payables, revenue, expenses, and net income',
      'tenant_1234_abcd',
    );

    expect(sql).toContain('"tenant_1234_abcd"."journal_lines"');
    expect(sql).toContain("a.type = 'Revenue'");
    expect(sql).toContain("a.type = 'Expense'");
    expect(sql).not.toContain("a.type = 'EXPENSE'");
  });

  it('does not override ordinary database questions', () => {
    expect(
      buildFinancialSnapshotQuery(
        'Show my latest five invoices',
        'tenant_1234_abcd',
      ),
    ).toBeNull();
  });
});

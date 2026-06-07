export function buildFinancialSnapshotQuery(
  userQuery: string,
  schemaName: string,
): string | null {
  const query = userQuery.toLowerCase();
  const metrics = [
    'cash',
    'receivable',
    'payable',
    'revenue',
    'expense',
    'net income',
    'financial snapshot',
    'financial position',
  ];
  const matches = metrics.filter((metric) => query.includes(metric)).length;
  if (matches < 3) return null;

  const schema = `"${schemaName}"`;
  return `SELECT
  (SELECT COALESCE(SUM(jl.debit - jl.credit), 0)
   FROM ${schema}."journal_lines" jl
   JOIN ${schema}."accounts" a ON a.id = jl.account_id
   WHERE a.code = '1000') AS cash,
  (SELECT COALESCE(SUM(i.total - COALESCE(p.paid, 0)), 0)
   FROM ${schema}."invoices" i
   LEFT JOIN (
     SELECT invoice_id, SUM(amount) AS paid
     FROM ${schema}."customer_payments"
     GROUP BY invoice_id
   ) p ON p.invoice_id = i.id
   WHERE i.status IN ('unpaid', 'partial')) AS receivables,
  (SELECT COALESCE(SUM(b.total - COALESCE(p.paid, 0)), 0)
   FROM ${schema}."vendor_bills" b
   LEFT JOIN (
     SELECT vendor_bill_id, SUM(amount) AS paid
     FROM ${schema}."vendor_payments"
     GROUP BY vendor_bill_id
   ) p ON p.vendor_bill_id = b.id
   WHERE b.status IN ('received', 'partial')) AS payables,
  (SELECT COALESCE(SUM(jl.credit - jl.debit), 0)
   FROM ${schema}."journal_lines" jl
   JOIN ${schema}."accounts" a ON a.id = jl.account_id
   WHERE a.type = 'Revenue') AS revenue,
  (SELECT COALESCE(SUM(jl.debit - jl.credit), 0)
   FROM ${schema}."journal_lines" jl
   JOIN ${schema}."accounts" a ON a.id = jl.account_id
   WHERE a.type = 'Expense') AS expenses,
  (SELECT COALESCE(SUM(
     CASE
       WHEN a.type = 'Revenue' THEN jl.credit - jl.debit
       WHEN a.type = 'Expense' THEN -(jl.debit - jl.credit)
       ELSE 0
     END
   ), 0)
   FROM ${schema}."journal_lines" jl
   JOIN ${schema}."accounts" a ON a.id = jl.account_id) AS net_income`;
}

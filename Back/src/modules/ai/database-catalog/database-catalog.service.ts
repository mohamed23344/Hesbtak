import { Injectable } from '@nestjs/common';
import {
  TENANT_SQL_SCHEMA,
  TENANT_SQL_TABLES,
} from '../langgraph/agents/tenant-sql';

const METRICS = `
- Ledger revenue = SUM(journal_lines.credit - journal_lines.debit) for accounts.type = 'Revenue'.
- Ledger expense = SUM(journal_lines.debit - journal_lines.credit) for accounts.type = 'Expense'.
- Net income = ledger revenue - ledger expense.
- Invoice sales = SUM(invoices.total) by issue_date. State clearly when using invoice sales rather than posted ledger revenue.
- Cash inflow = SUM(customer_payments.amount) by payment_date.
- Cash outflow = SUM(vendor_payments.amount) plus paid expenses when appropriate; disclose the chosen definition.
- Accounts receivable is outstanding invoice amount. When allocations are unavailable, use invoice total minus payments linked to the invoice.
- Accounts payable is vendor bill total minus payments linked to the bill.
- Account balance = SUM(debit - credit); reverse the display sign for Revenue, Liability, and Equity when a normal-credit presentation is requested.
- Account types are case-sensitive: Asset, Liability, Equity, Revenue, Expense.
- The current period must be bounded by the supplied as-of date. Never include future-dated records.
- For quarter comparisons, label an incomplete current quarter as quarter-to-date and do not compare it as though it were a completed quarter.
`;

@Injectable()
export class DatabaseCatalogService {
  prompt(schemaName: string) {
    return `Tenant schema: "${schemaName}".
Every table in FROM or JOIN must be qualified with this exact schema.

Tables:
${TENANT_SQL_SCHEMA}

Metric definitions:
${METRICS}

Allowed tables: ${TENANT_SQL_TABLES.join(', ')}.`;
  }
}

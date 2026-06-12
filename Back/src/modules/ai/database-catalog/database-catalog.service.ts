import { Injectable } from '@nestjs/common';
import { TENANT_SQL_TABLES } from '../langgraph/agents/tenant-sql';

const TABLES = `
accounts(id, parent_id, code, name, type, is_leaf, level, is_active, created_at)
customers(id, name, email, phone, address, payment_terms, currency, is_active, created_at, created_by)
vendors(id, name, email, phone, address, payment_terms, is_active, created_at, created_by)
bank_accounts(id, name, account_number, bank_name, currency, gl_account_id, is_active, created_at)
journal_entries(id, date, description, status, reference_type, reference_id, created_by, created_at)
journal_lines(id, journal_entry_id, account_id, debit, credit, description)
invoices(id, invoice_number, customer_id, issue_date, due_date, subtotal, tax_amount, total, status, journal_entry_id, created_by, created_at)
invoice_lines(id, invoice_id, line_number, description, quantity, unit_price, discount_amount, tax_rate, line_subtotal, tax_amount, line_total, revenue_account_id, created_at)
customer_payments(id, customer_id, invoice_id, amount, payment_method, bank_account_id, payment_date, reference, journal_entry_id, notes, created_by, created_at)
vendor_bills(id, bill_number, vendor_id, issue_date, due_date, subtotal, tax_amount, total, status, journal_entry_id, created_by, created_at)
vendor_bill_lines(id, vendor_bill_id, line_number, description, quantity, unit_cost, discount_amount, tax_rate, line_subtotal, tax_amount, line_total, expense_account_id, created_at)
vendor_payments(id, vendor_bill_id, vendor_id, amount, payment_method, bank_account_id, payment_date, reference, journal_entry_id, notes, created_by, created_at)
expenses(id, expense_number, expense_date, category, description, vendor_id, amount, tax_amount, total, expense_account_id, payment_method, bank_account_id, journal_entry_id, attachment_url, created_by, created_at)
sales_returns(id, return_number, invoice_id, customer_id, return_date, reason, subtotal, tax_amount, total, status, journal_entry_id, created_by, created_at)
sales_return_lines(id, sales_return_id, line_number, description, quantity, unit_price, tax_rate, line_subtotal, tax_amount, line_total)
purchase_returns(id, return_number, bill_id, vendor_id, return_date, reason, subtotal, tax_amount, total, status, journal_entry_id, created_by, created_at)
purchase_return_lines(id, purchase_return_id, line_number, description, quantity, unit_price, tax_rate, line_subtotal, tax_amount, line_total)
recurring_entries(id, name, frequency, start_date, end_date, next_run, is_active, template, created_by, created_at)
recurring_entry_logs(id, recurring_entry_id, journal_entry_id, generated_date, status, created_at)
ocr_uploads(id, file_url, extracted_text, confidence_score, status, result_type, result_id, created_by, created_at)
forecasts(id, forecast_month, predicted_revenue, predicted_expense, predicted_cashflow, model_version, confidence_low, confidence_high, created_at)
alerts(id, type, severity, title, message, entity_type, entity_id, is_read, created_at)
alert_rules(id, name, rule_type, parameters, is_active, created_at)
suggestions(id, type, title, description, status, created_at)
`;

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
${TABLES}

Metric definitions:
${METRICS}

Allowed tables: ${TENANT_SQL_TABLES.join(', ')}.`;
  }
}

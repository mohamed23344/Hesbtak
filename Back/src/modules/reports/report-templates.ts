import { ReportType } from './dto';

export const REPORT_TEMPLATES: Array<{
  type: ReportType;
  name: string;
  description: string;
}> = [
  { type: 'profit_loss', name: 'Profit & Loss Statement', description: 'Revenue, expenses, and net income by account.' },
  { type: 'balance_sheet', name: 'Balance Sheet', description: 'Assets, liabilities, and equity balances.' },
  { type: 'cash_flow', name: 'Cash Flow Statement', description: 'Cash movements grouped by month.' },
  { type: 'revenue', name: 'Revenue Report', description: 'Invoice revenue by customer and date.' },
  { type: 'expense', name: 'Expense Report', description: 'Expenses by category, vendor, and payment method.' },
  { type: 'accounts_receivable', name: 'Accounts Receivable Report', description: 'Outstanding customer invoices and balances.' },
  { type: 'accounts_payable', name: 'Accounts Payable Report', description: 'Outstanding vendor bills and balances.' },
  { type: 'sales', name: 'Sales Report', description: 'Sales invoices and customer totals.' },
  { type: 'tax', name: 'Tax Report', description: 'Collected and input tax transactions.' },
  { type: 'vendor_payments', name: 'Vendor Payments Report', description: 'Payments made to vendors.' },
  { type: 'customer_invoices', name: 'Customer Invoices Report', description: 'Detailed customer invoice register.' },
  { type: 'budget_vs_actual', name: 'Budget vs Actual Report', description: 'Forecast values compared with actual results.' },
  { type: 'custom', name: 'Custom Report', description: 'Choose a source, fields, grouping, sorting, and chart.' },
];

export const CUSTOM_FIELDS: Record<string, Array<{ key: string; label: string }>> = {
  invoices: [
    { key: 'invoice_number', label: 'Invoice Number' },
    { key: 'customer_name', label: 'Customer Name' },
    { key: 'issue_date', label: 'Issue Date' },
    { key: 'due_date', label: 'Due Date' },
    { key: 'subtotal', label: 'Subtotal' },
    { key: 'tax_amount', label: 'Tax' },
    { key: 'total', label: 'Amount' },
    { key: 'status', label: 'Status' },
    { key: 'created_at', label: 'Created At' },
  ],
  expenses: [
    { key: 'expense_number', label: 'Expense Number' },
    { key: 'description', label: 'Expense Name' },
    { key: 'category', label: 'Category' },
    { key: 'vendor_name', label: 'Vendor' },
    { key: 'amount', label: 'Amount' },
    { key: 'tax_amount', label: 'Tax' },
    { key: 'total', label: 'Total' },
    { key: 'expense_date', label: 'Payment Date' },
    { key: 'payment_method', label: 'Payment Method' },
    { key: 'created_at', label: 'Created At' },
  ],
  payments: [
    { key: 'reference', label: 'Reference' },
    { key: 'party_name', label: 'Party' },
    { key: 'amount', label: 'Amount' },
    { key: 'payment_date', label: 'Date' },
    { key: 'payment_method', label: 'Payment Method' },
    { key: 'notes', label: 'Notes' },
    { key: 'created_at', label: 'Created At' },
  ],
};

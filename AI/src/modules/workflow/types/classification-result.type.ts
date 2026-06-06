export type AccountingAction =
  | 'REVENUE'
  | 'EXPENSE'
  | 'ACCOUNTS_RECEIVABLE'
  | 'ACCOUNTS_PAYABLE';

export interface ClassificationResult {
  documentType: 'INVOICE' | 'BILL' | 'EXPENSE';

  accountingAction: AccountingAction;

  debitAccount: string;

  creditAccount: string;

  confidence: number;

  reasoning: string;
}
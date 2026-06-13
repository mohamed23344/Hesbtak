export type AssistantIntent =
  | 'financial_data'
  | 'accounting_knowledge'
  | 'product_help'
  | 'mixed'
  | 'general';

export type KnowledgeCorpus = 'accounting_workbook' | 'product_guide';

export type RequestPlan = {
  intent: AssistantIntent;
  goals: string[];
  outputMode: 'chat' | 'pdf_report';
  dateRange?: {
    from?: string;
    to?: string;
    preset?: string;
  };
  entities: Array<{
    type:
      | 'account'
      | 'customer'
      | 'vendor'
      | 'invoice'
      | 'journal'
      | 'other';
    value: string;
  }>;
  knowledgeCorpora: KnowledgeCorpus[];
  requiresFinancialData: boolean;
  requiresClarification: boolean;
  clarificationQuestion?: string;
};

export type FinancialDataRequest = {
  requestId: string;
  objective: string;
  businessQuestion: string;
  metrics: string[];
  dimensions: string[];
  filters: Array<{
    field: string;
    operator: 'eq' | 'in' | 'contains' | 'gte' | 'lte' | 'between';
    value: unknown;
  }>;
  dateRange?: {
    from?: string;
    to?: string;
  };
  expectedColumns: string[];
  preferredGranularity?:
    | 'transaction'
    | 'daily'
    | 'monthly'
    | 'quarterly'
    | 'summary';
  maxRows: number;
  reason: string;
};

export type QueryEvidence = {
  requestId: string;
  objective: string;
  dateRange?: {
    from?: string;
    to?: string;
  };
  status: 'success' | 'empty' | 'rejected' | 'error';
  sql?: string;
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncation?: {
    applied: boolean;
    limit: number;
  };
  assumptions: string[];
  warnings: string[];
  executionMs?: number;
};

export type AssistantCitation = {
  type: 'workbook' | 'product_page' | 'database_query';
  label: string;
  page?: number;
  route?: string;
  evidenceRequestId?: string;
};

export type AssistantLink = {
  label: string;
  route: string;
};

export type RetrievedChunk = {
  id: string;
  corpus: KnowledgeCorpus;
  documentId: string;
  chunkId: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
};

export type KnowledgeEvidence = {
  answer: string;
  citations: AssistantCitation[];
  links: AssistantLink[];
  chunks: RetrievedChunk[];
};

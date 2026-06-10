export type ReportProfile = {
  title: string;
  analysisType: string;
  focus: string;
  sections: string[];
  retrievalQueries: string[];
};

const REPORT_PROFILES: ReportProfile[] = [
  {
    title: 'Cost Optimization Report',
    analysisType: 'cost_optimization',
    focus: 'cost drivers, avoidable spending, savings opportunities, and prioritized reduction actions',
    sections: ['Cost Drivers', 'Savings Opportunities', 'Risks', 'Recommendations', 'Supporting Evidence'],
    retrievalQueries: [
      'expense transactions vendor bills recurring costs highest spending categories',
      'historical cost optimization recommendations and expense risks',
    ],
  },
  {
    title: 'Cash Flow Analysis Report',
    analysisType: 'cash_flow_analysis',
    focus: 'cash inflows, outflows, receivables, payables, working capital, and liquidity',
    sections: ['Liquidity Position', 'Cash Inflows and Outflows', 'Working Capital', 'Risks', 'Recommendations'],
    retrievalQueries: [
      'customer payments vendor payments cash inflows outflows receivables payables',
      'cash flow liquidity working capital historical risks',
    ],
  },
  {
    title: 'Risk Assessment Report',
    analysisType: 'risk_assessment',
    focus: 'financial exposure, severity, root causes, evidence, and mitigation',
    sections: ['Risk Summary', 'Risk Register', 'Financial Exposure', 'Mitigation Plan', 'Supporting Evidence'],
    retrievalQueries: [
      'financial risk anomalies overdue balances customer concentration vendor exposure',
      'historical risk findings warnings and mitigation recommendations',
    ],
  },
  {
    title: 'Profitability Analysis Report',
    analysisType: 'profitability_analysis',
    focus: 'revenue quality, expense pressure, net income, margins, and profitability drivers',
    sections: ['Profitability Summary', 'Revenue Drivers', 'Expense Pressure', 'Margin Analysis', 'Recommendations'],
    retrievalQueries: [
      'revenue invoices sales expense transactions profitability margin',
      'historical profitability analysis revenue and cost trends',
    ],
  },
  {
    title: 'Budget Planning Report',
    analysisType: 'budget_planning',
    focus: 'planning assumptions, spending allocation, targets, constraints, and budget priorities',
    sections: ['Planning Assumptions', 'Budget Priorities', 'Proposed Targets', 'Scenario Risks', 'Recommendations'],
    retrievalQueries: [
      'historical monthly revenue expenses spending categories budget baseline',
      'business plans priorities historical budget recommendations',
    ],
  },
  {
    title: 'Forecasting Report',
    analysisType: 'forecasting_analysis',
    focus: 'historical trends, forecast assumptions, projected direction, scenarios, and planning actions',
    sections: ['Forecast Basis', 'Projected Trends', 'Scenario Analysis', 'Forecast Risks', 'Planning Recommendations'],
    retrievalQueries: [
      'monthly revenue expense history seasonality growth forecast',
      'historical forecasts assumptions planning risks',
    ],
  },
  {
    title: 'Executive Summary',
    analysisType: 'executive_summary',
    focus: 'the most important business conclusions, risks, decisions, and immediate actions',
    sections: ['Executive Overview', 'Key Performance Signals', 'Top Risks', 'Priority Actions'],
    retrievalQueries: [
      'latest financial performance revenue expenses cash receivables payables',
      'most important risks opportunities and recommendations',
    ],
  },
  {
    title: 'Quarterly Review Report',
    analysisType: 'quarterly_review',
    focus: 'quarter performance, period comparison, KPI movement, risks, and next-quarter priorities',
    sections: ['Quarter Overview', 'Period Comparison', 'KPI Movement', 'Risks', 'Next-Quarter Priorities'],
    retrievalQueries: [
      'current quarter invoices expenses payments financial performance',
      'previous quarter financial performance comparison baseline',
    ],
  },
  {
    title: 'Financial Analysis Report',
    analysisType: 'financial_analysis',
    focus: 'overall financial health, revenue, expenses, cash, working capital, risks, and opportunities',
    sections: ['Executive Summary', 'Key Findings', 'Financial Performance', 'Risks', 'Opportunities', 'Recommendations'],
    retrievalQueries: [
      'current financial performance revenue expenses cash receivables payables',
      'historical financial insights trends risks recommendations',
    ],
  },
];

export function inferReportProfile(query: string): ReportProfile {
  const value = query.toLowerCase();
  if (value.includes('cost') || value.includes('optim') || value.includes('reduc')) return REPORT_PROFILES[0];
  if (value.includes('cash') || value.includes('liquidity') || value.includes('working capital')) return REPORT_PROFILES[1];
  if (value.includes('risk') || value.includes('exposure') || value.includes('threat')) return REPORT_PROFILES[2];
  if (value.includes('profit') || value.includes('margin') || value.includes('income')) return REPORT_PROFILES[3];
  if (value.includes('budget') || value.includes('allocation')) return REPORT_PROFILES[4];
  if (value.includes('forecast') || value.includes('projection')) return REPORT_PROFILES[5];
  if (value.includes('executive') || value.includes('overview')) return REPORT_PROFILES[6];
  if (value.includes('quarter') || value.includes('quarterly')) return REPORT_PROFILES[7];
  return REPORT_PROFILES[8];
}

export function reportProfileByTitle(title?: string): ReportProfile {
  return REPORT_PROFILES.find((profile) => profile.title === title) ?? REPORT_PROFILES[8];
}

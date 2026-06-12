import {
  explicitlyRequestsReport,
  requestPlannerAgentNode,
} from './request-planner-agent';

describe('requestPlannerAgentNode', () => {
  it('preserves explicit PDF output and mixed-source planning', async () => {
    const groq = {
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intent: 'mixed',
                    goals: ['analyze receivables', 'show collection page'],
                    outputMode: 'pdf_report',
                    entities: [],
                    knowledgeCorpora: [
                      'accounting_workbook',
                      'product_guide',
                    ],
                    requiresClarification: false,
                  }),
                },
              },
            ],
          }),
        },
      },
    };
    const result = await requestPlannerAgentNode(
      {
        userQuery:
          'Create a PDF explaining why receivables are high and where to collect them',
        conversationHistory: '',
      } as never,
      groq as never,
    );
    expect(result.intent).toBe('mixed');
    expect(result.requestPlan?.outputMode).toBe('pdf_report');
    expect(result.requestPlan?.knowledgeCorpora).toEqual([
      'accounting_workbook',
      'product_guide',
    ]);
  });
});

describe('explicitlyRequestsReport', () => {
  it.each([
    'Generate a PDF report for this year',
    'Create me a cost optimization report',
    'Export the analysis as PDF',
    'I need a downloadable document',
  ])('detects report request: %s', (query) => {
    expect(explicitlyRequestsReport(query)).toBe(true);
  });

  it('does not turn ordinary analysis into a report', () => {
    expect(explicitlyRequestsReport('Analyze my current costs')).toBe(false);
  });
});

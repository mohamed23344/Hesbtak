import {
  addGroundedProductLinks,
  broadProductRequest,
  extractToolUseFailedAnswer,
  isProceduralGuidanceQuery,
  pureAccountingTheoryQuery,
  shouldFetchOrgData,
} from './knowledge-guide-agent';

describe('broadProductRequest', () => {
  it.each([
    'Give me a comprehensive tour of all options and pages',
    'Show me the full system tour',
    'Explain all website modules',
  ])('detects comprehensive product coverage: %s', (query) => {
    expect(broadProductRequest(query)).toBe(true);
  });

  it('keeps a focused product question focused', () => {
    expect(broadProductRequest('How do I create a sales invoice?')).toBe(false);
  });
});

describe('shouldFetchOrgData', () => {
  it('prefers org data for personalized finance questions', () => {
    expect(
      shouldFetchOrgData('What are my current receivable balances?', []),
    ).toBe(true);
  });

  it('skips org data for pure accounting theory', () => {
    expect(
      shouldFetchOrgData('What is the difference between debit and credit?', []),
    ).toBe(false);
  });

  it('skips org data for comprehensive product tours', () => {
    expect(
      shouldFetchOrgData('Give me a full system tour of all pages', []),
    ).toBe(false);
  });

  it('skips org data for procedural how-to guidance', () => {
    expect(
      shouldFetchOrgData(
        'How do I record the purchase of construction equipment?',
        [],
      ),
    ).toBe(false);
    expect(
      isProceduralGuidanceQuery(
        'How do I record the purchase of construction equipment?',
      ),
    ).toBe(true);
  });

  it('still prefers org data when the user asks about their records', () => {
    expect(
      shouldFetchOrgData('Show me my current receivable balances', []),
    ).toBe(true);
  });
});

describe('extractToolUseFailedAnswer', () => {
  it('recovers text when Groq rejects a forced tool call', () => {
    const error = new Error(
      '400 {"error":{"message":"Tool choice is required, but model did not call a tool","code":"tool_use_failed","failed_generation":"Hello **world**"}}',
    );
    expect(extractToolUseFailedAnswer(error)).toBe('Hello **world**');
  });
});

describe('pureAccountingTheoryQuery', () => {
  it('detects conceptual accounting questions', () => {
    expect(pureAccountingTheoryQuery('Explain the accounting equation')).toBe(true);
  });
});

describe('addGroundedProductLinks', () => {
  it('turns a retrieved product page title into an inline route link', () => {
    const answer = addGroundedProductLinks('Open Customers to view the list.', [
      {
        corpus: 'product_guide',
        metadata: {
          title: 'Customers',
          route: '/dashboard/sales/customers',
        },
      },
    ]);

    expect(answer).toBe(
      'Open [Customers](/dashboard/sales/customers) to view the list.',
    );
  });
});

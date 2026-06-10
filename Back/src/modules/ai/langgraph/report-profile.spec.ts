import {
  inferReportProfile,
  reportProfileByTitle,
} from './report-profile';

describe('report profiles', () => {
  it.each([
    ['Reduce our cloud costs', 'Cost Optimization Report'],
    ['Review liquidity and cash flow', 'Cash Flow Analysis Report'],
    ['Prepare a profitability report', 'Profitability Analysis Report'],
    ['Forecast revenue for next quarter', 'Forecasting Report'],
    ['Give me an executive overview', 'Executive Summary'],
  ])('maps "%s" to %s', (query, title) => {
    expect(inferReportProfile(query).title).toBe(title);
  });

  it('falls back to a general financial analysis profile', () => {
    expect(reportProfileByTitle('Unknown').title).toBe(
      'Financial Analysis Report',
    );
  });
});

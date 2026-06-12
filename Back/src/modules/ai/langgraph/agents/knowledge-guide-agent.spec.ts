import { broadProductRequest } from './knowledge-guide-agent';

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

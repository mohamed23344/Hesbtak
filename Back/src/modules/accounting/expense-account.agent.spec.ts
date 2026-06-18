import 'reflect-metadata';
import { ExpenseAccountAgent } from './expense-account.agent';

describe('ExpenseAccountAgent', () => {
  const account = {
    id: 'expense-1',
    code: '5110',
    name: 'Office Supplies',
    parent_code: '5100',
    parent_name: 'Operating Expenses',
  };

  it('uses the only active leaf expense account without calling AI', async () => {
    const query = jest.fn().mockResolvedValue([account]);
    const agent = new ExpenseAccountAgent(
      { $queryRawUnsafe: query } as never,
      { quote: (schema: string) => `"${schema}"` } as never,
      {} as never,
    );

    const result = await agent.classify(
      {
        organizationId: 'organization-1',
        schemaName: 'tenant_test',
      } as never,
      'Stationery Vendor',
      ['Printer paper and pens'],
    );

    expect(result).toMatchObject({
      accountId: 'expense-1',
      code: '5110',
      confidence: 1,
    });
    expect(String(query.mock.calls[0][0])).toContain(
      "account.type = 'Expense'",
    );
    expect(String(query.mock.calls[0][0])).toContain('NOT EXISTS');
  });

  it('accepts only user selections from the available expense accounts', async () => {
    const agent = new ExpenseAccountAgent(
      { $queryRawUnsafe: jest.fn().mockResolvedValue([account]) } as never,
      { quote: (schema: string) => `"${schema}"` } as never,
      {} as never,
    );

    await expect(
      agent.selected(
        {
          organizationId: 'organization-1',
          schemaName: 'tenant_test',
        } as never,
        'unavailable-account',
      ),
    ).rejects.toThrow('Select an active leaf expense account');

    await expect(
      agent.selected(
        {
          organizationId: 'organization-1',
          schemaName: 'tenant_test',
        } as never,
        'expense-1',
      ),
    ).resolves.toMatchObject({
      accountId: 'expense-1',
      reason: 'Selected by the user.',
    });
  });

  it.each([
    'expense-1',
    '5110',
    'Office Supplies',
    '5110 - Office Supplies',
  ])('resolves a model account reference of %s', (reference) => {
    const agent = new ExpenseAccountAgent(
      {} as never,
      {} as never,
      {} as never,
    );

    expect((agent as any).resolveAccount([account], reference)).toEqual(account);
  });

  it('parses concise model JSON with an account code', () => {
    const agent = new ExpenseAccountAgent(
      {} as never,
      {} as never,
      {} as never,
    );

    expect((agent as any).parseResult('{"code":"5110"}')).toEqual({
      accountReference: '5110',
      confidence: 0.8,
      reason: 'Closest matching expense account.',
    });
  });
});

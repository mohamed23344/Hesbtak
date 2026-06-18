import 'reflect-metadata';
import { RevenueAccountAgent } from './revenue-account.agent';

describe('RevenueAccountAgent', () => {
  it('uses the only active leaf revenue account without calling AI', async () => {
    const db = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        {
          id: 'revenue-1',
          code: '4010',
          name: 'Consulting Revenue',
          parent_code: '4000',
          parent_name: 'Revenue',
        },
      ]),
    };
    const agent = new RevenueAccountAgent(
      db as never,
      { quote: (schema: string) => `"${schema}"` } as never,
      {} as never,
    );

    const result = await agent.classify(
      {
        organizationId: 'organization-1',
        schemaName: 'tenant_test',
      } as never,
      [{ description: 'Monthly advisory retainer', quantity: 1, unitPrice: 500 }],
    );

    expect(result).toMatchObject({
      accountId: 'revenue-1',
      code: '4010',
      confidence: 1,
    });
    expect(String(db.$queryRawUnsafe.mock.calls[0][0])).toContain(
      "account.type = 'Revenue'",
    );
    expect(String(db.$queryRawUnsafe.mock.calls[0][0])).toContain(
      'NOT EXISTS',
    );
  });

  it('rejects classification when no revenue accounts are available', async () => {
    const agent = new RevenueAccountAgent(
      { $queryRawUnsafe: jest.fn().mockResolvedValue([]) } as never,
      { quote: (schema: string) => `"${schema}"` } as never,
      {} as never,
    );

    await expect(
      agent.classify(
        {
          organizationId: 'organization-1',
          schemaName: 'tenant_test',
        } as never,
        [{ description: 'Product sale', quantity: 1, unitPrice: 100 }],
      ),
    ).rejects.toThrow('Add at least one active revenue account');
  });

  it('accepts only a user-selected account from the available revenue list', async () => {
    const agent = new RevenueAccountAgent(
      {
        $queryRawUnsafe: jest.fn().mockResolvedValue([
          {
            id: 'revenue-1',
            code: '4010',
            name: 'Consulting Revenue',
            parent_code: '4000',
            parent_name: 'Revenue',
          },
        ]),
      } as never,
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
    ).rejects.toThrow('Select an active leaf revenue account');

    await expect(
      agent.selected(
        {
          organizationId: 'organization-1',
          schemaName: 'tenant_test',
        } as never,
        'revenue-1',
      ),
    ).resolves.toMatchObject({
      accountId: 'revenue-1',
      code: '4010',
      reason: 'Selected by the user.',
    });
  });
});

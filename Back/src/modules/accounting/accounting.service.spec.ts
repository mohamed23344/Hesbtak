import 'reflect-metadata';
import { AccountingService } from './accounting.service';

describe('AccountingService expense vendors', () => {
  it('lists only vendors attached to the requested bill type', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 'vendor-1', name: 'Expense Vendor' }]);
    const service = new AccountingService(
      { $queryRawUnsafe: query } as never,
      { quote: (schema: string) => `"${schema}"` } as never,
      {} as never,
      {} as never,
    );

    await service.listVendors({ schemaName: 'tenant_test' } as never, 'expense');

    expect(String(query.mock.calls[0][0])).toContain('JOIN "tenant_test".vendor_bills');
    expect(String(query.mock.calls[0][0])).toContain('WHERE b.type = $1');
    expect(query.mock.calls[0][1]).toBe('expense');
  });

  it('filters vendor activity and payments by expense bill type', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ id: 'vendor-1' }])
      .mockResolvedValueOnce([{ id: 'bill-1', type: 'expense' }])
      .mockResolvedValueOnce([]);
    const service = new AccountingService(
      { $queryRawUnsafe: query } as never,
      { quote: (schema: string) => `"${schema}"` } as never,
      {} as never,
      {} as never,
    );

    await service.getVendorActivity(
      { schemaName: 'tenant_test' } as never,
      'vendor-1',
      'expense',
    );

    expect(String(query.mock.calls[1][0])).toContain('b.type = $2');
    expect(String(query.mock.calls[2][0])).toContain('b.type = $2');
    expect(query.mock.calls[1][2]).toBe('expense');
    expect(query.mock.calls[2][2]).toBe('expense');
  });
});

describe('AccountingService sales invoice asset accounts', () => {
  const createService = () => {
    const query = jest.fn().mockImplementation(
      (_sql: string, code: string) => Promise.resolve([{ id: `account-${code}` }]),
    );
    const service = new AccountingService(
      { $queryRawUnsafe: query } as never,
      { quote: (schema: string) => `"${schema}"` } as never,
      {} as never,
      {} as never,
    );
    return { service, query };
  };

  it.each([
    ['unpaid', undefined, '1110'],
    ['draft', undefined, '1110'],
    ['paid', 'cash', '1130'],
    ['paid', 'bank', '1140'],
    ['paid', 'transfer', '1140'],
    ['paid', 'bank_transfer', '1140'],
    ['paid', 'card', '1150'],
  ] as const)(
    'maps %s invoices paid by %s to account %s',
    async (status, method, expectedCode) => {
      const { service, query } = createService();

      const result = await (service as any).salesInvoiceAssetAccount(
        { schemaName: 'tenant_test' },
        status,
        method,
      );

      expect(result).toBe(`account-${expectedCode}`);
      expect(query.mock.calls[0][1]).toBe(expectedCode);
    },
  );

  it('requires a supported payment method for paid invoices', async () => {
    const { service } = createService();

    await expect(
      (service as any).salesInvoiceAssetAccount(
        { schemaName: 'tenant_test' },
        'paid',
        'cheque',
      ),
    ).rejects.toThrow('support cash, bank transfer, or card');
  });
});

describe('AccountingService purchase bill related accounts', () => {
  const createService = () => {
    const query = jest.fn().mockImplementation(
      (_sql: string, code: string) => Promise.resolve([{ id: `account-${code}` }]),
    );
    const service = new AccountingService(
      { $queryRawUnsafe: query } as never,
      { quote: (schema: string) => `"${schema}"` } as never,
      {} as never,
      {} as never,
    );
    return { service, query };
  };

  it.each([
    ['received', undefined, '2110'],
    ['draft', undefined, '2110'],
    ['paid', 'cash', '1130'],
    ['paid', 'bank', '1140'],
    ['paid', 'transfer', '1140'],
    ['paid', 'bank_transfer', '1140'],
    ['paid', 'card', '1150'],
  ] as const)(
    'maps %s purchase bills paid by %s to account %s',
    async (status, method, expectedCode) => {
      const { service, query } = createService();

      const result = await (service as any).purchaseBillRelatedAccount(
        { schemaName: 'tenant_test' },
        status,
        method,
      );

      expect(result).toBe(`account-${expectedCode}`);
      expect(query.mock.calls[0][1]).toBe(expectedCode);
    },
  );

  it('rejects unsupported paid purchase bill methods', async () => {
    const { service } = createService();

    await expect(
      (service as any).purchaseBillRelatedAccount(
        { schemaName: 'tenant_test' },
        'paid',
        'cheque',
      ),
    ).rejects.toThrow('support cash, bank transfer, or card');
  });
});

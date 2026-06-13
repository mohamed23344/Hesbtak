import 'reflect-metadata';
import { AccountingService } from './accounting.service';

describe('AccountingService expense vendors', () => {
  it('lists only vendors attached to the requested bill type', async () => {
    const query = jest.fn().mockResolvedValue([{ id: 'vendor-1', name: 'Expense Vendor' }]);
    const service = new AccountingService(
      { $queryRawUnsafe: query } as never,
      { quote: (schema: string) => `"${schema}"` } as never,
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

import { ConfigService } from '@nestjs/config';
import { AccountingService } from '../accounting/accounting.service';
import { TenantContext } from '../tenant/tenant.service';
import { AiInvoiceExtractionService } from './ai-invoice-extraction.service';

describe('AiInvoiceExtractionService', () => {
  const ctx = {
    organizationId: 'org-1',
    schemaName: 'tenant_test',
  } as TenantContext;
  const accounting = {
    createCustomer: jest.fn(),
    createVendor: jest.fn(),
    createInvoice: jest.fn(),
    createVendorBill: jest.fn(),
  } as unknown as jest.Mocked<AccountingService>;
  const service = new AiInvoiceExtractionService(
    new ConfigService(),
    accounting,
  );

  beforeEach(() => jest.clearAllMocks());

  it('keeps missing model fields null for user review', () => {
    const draft = (
      service as unknown as {
        normalizeDraft: (value: unknown) => Record<string, any>;
      }
    ).normalizeDraft({
      party: { name: null },
      issueDate: null,
      lines: [{ description: 'Service', quantity: null }],
    });

    expect(draft.issueDate).toBeNull();
    expect(draft.dueDate).toBeNull();
    expect(draft.lines[0]).toEqual({
      description: 'Service',
      quantity: null,
      unitPrice: null,
      discountAmount: null,
      taxRate: null,
    });
  });

  it('confirms a reviewed sales draft through invoice posting', async () => {
    accounting.createCustomer.mockResolvedValue({ id: 'customer-1' });
    accounting.createInvoice.mockResolvedValue({
      id: 'invoice-1',
      invoiceNumber: 'INV-00001',
      total: '110',
      status: 'unpaid',
    });

    await service.confirm(ctx, 'user-1', {
      section: 'sales',
      party: { name: 'New Customer' },
      issueDate: '2026-06-12',
      dueDate: '2026-06-30',
      accountId: 'revenue-account-id',
      relatedAccountId: 'receivable-account-id',
      status: 'open',
      lines: [
        {
          description: 'Consulting',
          quantity: 1,
          unitPrice: 100,
          taxRate: 10,
        },
      ],
    });

    expect(accounting.createCustomer).toHaveBeenCalled();
    expect(accounting.createInvoice).toHaveBeenCalledWith(
      ctx,
      'user-1',
      expect.objectContaining({
        customerId: 'customer-1',
        status: 'unpaid',
      }),
    );
  });

  it('confirms purchase and expense drafts as vendor bills', async () => {
    accounting.createVendor.mockResolvedValue({ id: 'vendor-1' });
    accounting.createVendorBill.mockResolvedValue({
      id: 'bill-1',
      billNumber: 'BILL-00001',
      total: '50',
      status: 'received',
      type: 'expense',
    });

    await service.confirm(ctx, 'user-1', {
      section: 'expenses',
      party: { name: 'New Vendor' },
      issueDate: '2026-06-12',
      dueDate: '2026-06-12',
      accountId: 'expense-account-id',
      relatedAccountId: 'payable-account-id',
      status: 'open',
      lines: [
        {
          description: 'Office supplies',
          quantity: 1,
          unitPrice: 50,
        },
      ],
    });

    expect(accounting.createVendor).toHaveBeenCalled();
    expect(accounting.createVendorBill).toHaveBeenCalledWith(
      ctx,
      'user-1',
      expect.objectContaining({
        vendorId: 'vendor-1',
        accountId: 'expense-account-id',
        relatedAccountId: 'payable-account-id',
        status: 'received',
        type: 'expense',
      }),
    );
  });

  it('allows an expense draft without a vendor', async () => {
    accounting.createVendorBill.mockResolvedValue({
      id: 'bill-2',
      billNumber: 'BILL-00002',
      total: '25',
      status: 'paid',
      type: 'expense',
    });

    await service.confirm(ctx, 'user-1', {
      section: 'expenses',
      issueDate: '2026-06-12',
      dueDate: '2026-06-12',
      accountId: 'expense-account-id',
      relatedAccountId: 'cash-account-id',
      status: 'paid',
      paymentMethod: 'cash',
      lines: [{ description: 'Transport', quantity: 1, unitPrice: 25 }],
    });

    expect(accounting.createVendor).not.toHaveBeenCalled();
    expect(accounting.createVendorBill).toHaveBeenCalledWith(
      ctx,
      'user-1',
      expect.objectContaining({
        vendorId: undefined,
        type: 'expense',
        accountId: 'expense-account-id',
        relatedAccountId: 'cash-account-id',
      }),
    );
  });
});

import { createHmac } from 'crypto';
import { BillingService } from './billing.service';

describe('BillingService Paymob callbacks', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      FRONTEND_URL: 'http://localhost:8080',
      PAYMOB_HMAC_SECRET: 'test-hmac-secret',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('activates a pending subscription from a successful signed return callback', async () => {
    const subscription = {
      id: 'subscription-id',
      organizationId: 'organization-id',
      status: 'pending',
    };
    const db = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue(subscription),
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        update: jest.fn().mockResolvedValue({ ...subscription, status: 'active' }),
      },
      $transaction: jest.fn().mockImplementation(async (operations) =>
        Promise.all(operations),
      ),
    };
    const service = new BillingService(db as never, {} as never);
    const query = signedCallback({
      reference: 'sub-reference',
      success: 'true',
      id: 'transaction-id',
    });

    const redirect = await service.paymentReturn(query);

    expect(redirect).toBe(
      'http://localhost:8080/dashboard/settings?payment=success&reference=sub-reference',
    );
    expect(db.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'subscription-id' },
        data: expect.objectContaining({
          status: 'active',
          paymobTransactionId: 'transaction-id',
        }),
      }),
    );
  });

  it('rejects a return callback with an invalid signature', async () => {
    const service = new BillingService({} as never, {} as never);
    const redirect = await service.paymentReturn({
      reference: 'sub-reference',
      success: 'true',
      hmac: 'invalid',
    });

    expect(redirect).toContain('payment=failed');
    expect(redirect).toContain('reason=invalid-signature');
  });
});

function signedCallback(overrides: Record<string, unknown>) {
  const query: Record<string, unknown> = {
    amount_cents: '49900',
    created_at: '2026-06-10T10:00:00.000000',
    currency: 'EGP',
    error_occured: 'false',
    has_parent_transaction: 'false',
    id: 'transaction-id',
    integration_id: '123456',
    is_3d_secure: 'true',
    is_auth: 'false',
    is_capture: 'false',
    is_refunded: 'false',
    is_standalone_payment: 'true',
    is_voided: 'false',
    order: '987654',
    owner: '111222',
    pending: 'false',
    'source_data.pan': '2346',
    'source_data.sub_type': 'MasterCard',
    'source_data.type': 'card',
    success: 'true',
    ...overrides,
  };
  const fields = [
    'amount_cents',
    'created_at',
    'currency',
    'error_occured',
    'has_parent_transaction',
    'id',
    'integration_id',
    'is_3d_secure',
    'is_auth',
    'is_capture',
    'is_refunded',
    'is_standalone_payment',
    'is_voided',
    'order',
    'owner',
    'pending',
    'source_data.pan',
    'source_data.sub_type',
    'source_data.type',
    'success',
  ];
  const values = fields.map((field) => String(query[field] ?? '')).join('');
  query.hmac = createHmac('sha512', 'test-hmac-secret')
    .update(values)
    .digest('hex');
  return query;
}

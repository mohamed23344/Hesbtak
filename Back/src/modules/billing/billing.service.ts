import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { DataBaseService } from '../../database/database.service';
import { TenantService } from '../tenant/tenant.service';

type PaymobIntentionResponse = {
  id?: string;
  client_secret?: string;
  intention_order_id?: string | number;
};

@Injectable()
export class BillingService {
  constructor(
    private readonly db: DataBaseService,
    private readonly tenant: TenantService,
  ) {}

  async plans() {
    await this.ensurePlans();
    return this.db.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  async current(organizationId: string, userId: string) {
    await this.tenant.fromOrganizationId(organizationId, userId);
    return this.tenant.subscriptionForOrganization(organizationId);
  }

  async checkout(organizationId: string, userId: string, planId: string) {
    await this.tenant.fromOrganizationId(organizationId, userId, ['owner']);
    this.assertPaymobConfigured();
    await this.ensurePlans();

    const [plan, user, organization] = await Promise.all([
      this.db.plan.findFirst({ where: { id: planId, isActive: true } }),
      this.db.user.findUnique({ where: { id: userId } }),
      this.db.organization.findUnique({ where: { id: organizationId } }),
    ]);
    if (!plan) throw new NotFoundException('Subscription plan not found');
    if (!user || !organization) throw new NotFoundException('Checkout account not found');

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    const reference = `sub_${randomUUID()}`;
    const subscription = await this.db.subscription.create({
      data: {
        organizationId,
        planId,
        status: 'pending',
        paymentReference: reference,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    const [firstName, ...lastNameParts] = user.fullName.trim().split(/\s+/);
    const paymentMethods = process.env.PAYMOB_PAYMENT_METHOD_IDS!
      .split(',')
      .map((value) => Number(value.trim()))
      .filter(Number.isFinite);
    const apiUrl = process.env.PAYMOB_API_URL ?? 'https://accept.paymob.com';
    const response = await fetch(`${apiUrl}/v1/intention/`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${process.env.PAYMOB_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: Math.round(Number(plan.price) * 100),
        currency: plan.currency,
        payment_methods: paymentMethods,
        items: [
          {
            name: `${plan.name} monthly subscription`,
            amount: Math.round(Number(plan.price) * 100),
            description: `Hesbtk.AI ${plan.name} plan`,
            quantity: 1,
          },
        ],
        billing_data: {
          first_name: firstName || 'Hesbtk',
          last_name: lastNameParts.join(' ') || 'Customer',
          email: user.email,
          phone_number: 'NA',
          apartment: 'NA',
          floor: 'NA',
          street: 'NA',
          building: 'NA',
          shipping_method: 'NA',
          postal_code: 'NA',
          city: 'Cairo',
          country: 'EG',
          state: 'Cairo',
        },
        special_reference: reference,
        extras: {
          subscription_id: subscription.id,
          organization_id: organization.id,
          plan_code: plan.code,
        },
        notification_url: `${this.backendUrl()}/api/v1/subscriptions/paymob/webhook`,
        redirection_url: `${this.backendUrl()}/api/v1/subscriptions/paymob/return`,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as PaymobIntentionResponse & {
      detail?: string;
      message?: string;
    };
    if (!response.ok || !payload.client_secret) {
      await this.db.subscription.update({
        where: { id: subscription.id },
        data: { status: 'failed' },
      });
      throw new BadRequestException(
        payload.detail ?? payload.message ?? 'Paymob checkout could not be created',
      );
    }

    await this.db.subscription.update({
      where: { id: subscription.id },
      data: { paymobIntentionId: payload.id ?? String(payload.intention_order_id ?? '') },
    });

    return {
      checkoutUrl:
        `${apiUrl}/unifiedcheckout/?publicKey=${encodeURIComponent(process.env.PAYMOB_PUBLIC_KEY!)}` +
        `&clientSecret=${encodeURIComponent(payload.client_secret)}`,
      reference,
    };
  }

  async verify(organizationId: string, userId: string, reference: string) {
    await this.tenant.fromOrganizationId(organizationId, userId);

    const subscription = await this.db.subscription.findFirst({
      where: { organizationId, paymentReference: reference },
      include: { plan: true },
    });
    if (!subscription) throw new NotFoundException('Subscription payment not found');

    // If still pending, proactively query Paymob to close the webhook race condition
    if (subscription.status === 'pending' && subscription.paymobIntentionId) {
      await this.syncFromPaymob(subscription.id, subscription.paymobIntentionId);

      const updated = await this.db.subscription.findUnique({
        where: { id: subscription.id },
        include: { plan: true },
      });
      return this.serialize(updated!);
    }

    return this.serialize(subscription);
  }

  async webhook(body: Record<string, unknown>, hmac?: string) {
    if (!this.validHmac(body, hmac)) {
      throw new UnauthorizedException('Invalid Paymob webhook signature');
    }

    const obj = this.record(body.obj) ?? body;
    const success = obj.success === true;
    const reference =
      this.string(obj.special_reference) ??
      this.string(this.record(obj.order)?.merchant_order_id) ??
      this.findString(body, 'special_reference');
    const subscriptionId = this.findString(body, 'subscription_id');
    const subscription = subscriptionId
      ? await this.db.subscription.findUnique({ where: { id: subscriptionId } })
      : reference
        ? await this.db.subscription.findUnique({ where: { paymentReference: reference } })
        : null;
    if (!subscription) throw new NotFoundException('Subscription webhook reference not found');

    const transactionId = this.string(obj.id);
    if (success) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
      await this.db.$transaction([
        this.db.subscription.updateMany({
          where: {
            organizationId: subscription.organizationId,
            status: 'active',
            id: { not: subscription.id },
          },
          data: { status: 'replaced' },
        }),
        this.db.subscription.update({
          where: { id: subscription.id },
          data: {
            status: 'active',
            paymobTransactionId: transactionId,
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        }),
      ]);
    } else {
      await this.db.subscription.update({
        where: { id: subscription.id },
        data: { status: 'failed', paymobTransactionId: transactionId },
      });
    }
    return { received: true };
  }

  /**
   * Handles Paymob's browser redirect after payment.
   * Paymob appends query params like `success`, `merchant_order_id`, `txn_response_code`, etc.
   * We redirect the user to the frontend settings page with the payment reference so it
   * can call /verify and show the correct status.
   */
  async paymentReturn(query: Record<string, unknown>): Promise<string> {
    const frontendUrl = (
      process.env.FRONTEND_URL ?? 'http://localhost:8080'
    ).replace(/\/+$/, '');

    // Paymob sends the reference as `merchant_order_id` or `special_reference` in the redirect
    const reference =
      this.string(query['merchant_order_id']) ??
      this.string(query['special_reference']) ??
      this.string(query['order']) ??
      '';

    const success = query['success'] === 'true' || query['success'] === true;

    if (!reference) {
      return `${frontendUrl}/dashboard/settings?payment=return`;
    }

    return (
      `${frontendUrl}/dashboard/settings` +
      `?payment=return` +
      `&reference=${encodeURIComponent(reference)}` +
      `&success=${success ? 'true' : 'false'}`
    );
  }
private async syncFromPaymob(subscriptionId: string, _intentionId: string) {
  try {
    const sub = await this.db.subscription.findUnique({
      where: { id: subscriptionId },
    });
    if (!sub?.paymentReference) return;

    const apiUrl = process.env.PAYMOB_API_URL ?? 'https://accept.paymob.com';

    // Query transactions by special_reference
    const response = await fetch(
      `${apiUrl}/api/acceptance/transactions?special_reference=${encodeURIComponent(sub.paymentReference)}`,
      {
        headers: {
          Authorization: `Token ${process.env.PAYMOB_SECRET_KEY}`,
        },
      },
    );

    console.log(`[syncFromPaymob] Response status: ${response.status}`);
    if (!response.ok) {
      console.error(`[syncFromPaymob] Error: ${await response.text()}`);
      return;
    }

    const data = (await response.json()) as {
      results?: Array<{ id: number; success: boolean; pending: boolean; error_occured: boolean }>;
    };

    console.log(`[syncFromPaymob] Transactions: ${JSON.stringify(data.results)}`);

    const successfulTxn = data.results?.find((t) => t.success === true && !t.pending);
    const failedTxn = data.results?.find((t) => t.error_occured === true && !t.pending);

    if (successfulTxn) {
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);

      await this.db.$transaction([
        this.db.subscription.updateMany({
          where: {
            organizationId: sub.organizationId,
            status: 'active',
            id: { not: subscriptionId },
          },
          data: { status: 'replaced' },
        }),
        this.db.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: 'active',
            paymobTransactionId: String(successfulTxn.id),
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        }),
      ]);
    } else if (failedTxn) {
      await this.db.subscription.update({
        where: { id: subscriptionId },
        data: { status: 'failed', paymobTransactionId: String(failedTxn.id) },
      });
    }
  } catch (err) {
    console.error('[syncFromPaymob] Unexpected error:', err);
  }
}

  private async ensurePlans() {
    const plans = [
      {
        code: 'regular',
        name: 'Regular',
        price: 299,
        currency: 'EGP',
        billingCycle: 'monthly',
        features: {
          chatbot: false,
          invoiceAiExtraction: false,
          scheduledReports: false,
          forecasting: false,
          reports: true,
        },
      },
      {
        code: 'plus',
        name: 'Plus',
        price: 399,
        currency: 'EGP',
        billingCycle: 'monthly',
        features: {
          chatbot: false,
          invoiceAiExtraction: false,
          scheduledReports: true,
          forecasting: true,
          reports: true,
        },
      },
      {
        code: 'pro',
        name: 'Pro',
        price: 499,
        currency: 'EGP',
        billingCycle: 'monthly',
        features: {
          chatbot: true,
          invoiceAiExtraction: true,
          scheduledReports: true,
          forecasting: true,
          reports: true,
        },
      },
    ];
    for (const plan of plans) {
      await this.db.plan.upsert({
        where: { code: plan.code },
        create: plan,
        update: { ...plan, isActive: true },
      });
    }

    const [regular, pro, legacyPlans] = await Promise.all([
      this.db.plan.findUniqueOrThrow({ where: { code: 'regular' } }),
      this.db.plan.findUniqueOrThrow({ where: { code: 'pro' } }),
      this.db.plan.findMany({ where: { code: { notIn: plans.map((plan) => plan.code) } } }),
    ]);
    for (const legacyPlan of legacyPlans) {
      await this.db.subscription.updateMany({
        where: { planId: legacyPlan.id },
        data: { planId: legacyPlan.code === 'ai_pro' ? pro.id : regular.id },
      });
    }
    if (legacyPlans.length) {
      await this.db.plan.deleteMany({ where: { id: { in: legacyPlans.map((plan) => plan.id) } } });
    }
  }

  private assertPaymobConfigured() {
    const missing = [
      'PAYMOB_SECRET_KEY',
      'PAYMOB_PUBLIC_KEY',
      'PAYMOB_PAYMENT_METHOD_IDS',
    ].filter((key) => !process.env[key]);
    if (missing.length) {
      throw new BadRequestException(`Paymob is not configured: ${missing.join(', ')}`);
    }
  }

  private backendUrl() {
    return (
      process.env.BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
    ).replace(/\/+$/, '');
  }

  private serialize(subscription: {
    id: string;
    status: string;
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    paymentReference: string | null;
    plan: {
      id: string;
      code: string;
      name: string;
      price: unknown;
      currency: string;
      features: unknown;
    };
  }) {
    return {
      id: subscription.id,
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      paymentReference: subscription.paymentReference,
      plan: {
        ...subscription.plan,
        price: Number(subscription.plan.price),
      },
    };
  }

  private validHmac(body: Record<string, unknown>, supplied?: string) {
    const secret = process.env.PAYMOB_HMAC_SECRET;
    if (!secret) return process.env.NODE_ENV !== 'production';
    if (!supplied) return false;
    const obj = this.record(body.obj) ?? body;
    const order = this.record(obj.order);
    const source = this.record(obj.source_data);
    const values = [
      obj.amount_cents,
      obj.created_at,
      obj.currency,
      obj.error_occured,
      obj.has_parent_transaction,
      obj.id,
      obj.integration_id,
      obj.is_3d_secure,
      obj.is_auth,
      obj.is_capture,
      obj.is_refunded,
      obj.is_standalone_payment,
      obj.is_voided,
      order?.id,
      obj.owner,
      obj.pending,
      source?.pan,
      source?.sub_type,
      source?.type,
      obj.success,
    ]
      .map((value) => String(value ?? ''))
      .join('');
    const expected = createHmac('sha512', secret).update(values).digest('hex');
    const expectedBuffer = Buffer.from(expected);
    const suppliedBuffer = Buffer.from(supplied);
    return (
      expectedBuffer.length === suppliedBuffer.length &&
      timingSafeEqual(expectedBuffer, suppliedBuffer)
    );
  }

  private record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private string(value: unknown) {
    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : undefined;
  }

  private findString(value: unknown, key: string): string | undefined {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = this.findString(item, key);
        if (found) return found;
      }
      return undefined;
    }
    const record = this.record(value);
    if (!record) return undefined;
    if (record[key] !== undefined) return this.string(record[key]);
    for (const item of Object.values(record)) {
      const found = this.findString(item, key);
      if (found) return found;
    }
    return undefined;
  }
}

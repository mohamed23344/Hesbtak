import { NestFactory } from '@nestjs/core';
import { SchedulerRegistry } from '@nestjs/schedule';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { DataBaseService } from '../src/database/database.service';
import { AccountingService } from '../src/modules/accounting/accounting.service';
import {
  TenantContext,
  TenantService,
} from '../src/modules/tenant/tenant.service';

const DEMO_OWNER_EMAIL = 'owner@demo.hesbetak.ai';
const DEMO_OWNER_PASSWORD = 'Demo@12345';
const DEMO_OWNER_NAME = 'Mohamed Salah';
const DEMO_ORG_NAME = 'Demo Accounting Co';
const DEMO_ORG_INDUSTRY = 'Professional Services';
const DEMO_ORG_CURRENCY = 'EGP';

const PLAN_SEED = [
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
] as const;

type SeededParty = { id: string; name: string };
type SeedAccounts = Record<
  | 'cash'
  | 'bank'
  | 'revenue'
  | 'rent'
  | 'hospitality'
  | 'salaries'
  | 'bankCharges'
  | 'utilities'
  | 'transportation'
  | 'supplies'
  | 'professionalFees'
  | 'maintenance'
  | 'benefits',
  string
>;

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return isoDate(date);
}

function plusDays(fromIso: string, days: number): string {
  const date = new Date(`${fromIso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

async function main() {
  console.log('Bootstrapping Nest application context...');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  stopScheduledJobs(app);

  try {
    const db = app.get(DataBaseService);
    const tenant = app.get(TenantService);
    const accounting = app.get(AccountingService);

    console.log('Seeding public plans...');
    for (const plan of PLAN_SEED) {
      await db.plan.upsert({
        where: { code: plan.code },
        create: {
          code: plan.code,
          name: plan.name,
          price: plan.price,
          currency: plan.currency,
          billingCycle: plan.billingCycle,
          features: plan.features,
          isActive: true,
        },
        update: {
          name: plan.name,
          price: plan.price,
          currency: plan.currency,
          billingCycle: plan.billingCycle,
          features: plan.features,
          isActive: true,
        },
      });
    }
    const proPlan = await db.plan.findUniqueOrThrow({ where: { code: 'pro' } });

    console.log('Seeding demo owner...');
    const passwordHash = await bcrypt.hash(DEMO_OWNER_PASSWORD, 12);
    const user = await db.user.upsert({
      where: { email: DEMO_OWNER_EMAIL },
      create: {
        fullName: DEMO_OWNER_NAME,
        email: DEMO_OWNER_EMAIL,
        passwordHash,
        emailVerifiedAt: new Date(),
        globalRole: 'user',
        isActive: true,
        mustChangePassword: false,
      },
      update: {
        fullName: DEMO_OWNER_NAME,
        passwordHash,
        emailVerifiedAt: new Date(),
        globalRole: 'user',
        isActive: true,
        mustChangePassword: false,
      },
    });

    console.log('Seeding demo organization...');
    const existingMembership = await db.organizationUser.findFirst({
      where: {
        userId: user.id,
        organization: { name: DEMO_ORG_NAME },
      },
      include: { organization: true },
    });

    const organizationId = randomUUID();
    const organization =
      existingMembership?.organization ??
      (await db.organization.create({
        data: {
          id: organizationId,
          name: DEMO_ORG_NAME,
          industry: DEMO_ORG_INDUSTRY,
          currency: DEMO_ORG_CURRENCY,
          schemaName: tenant.schemaNameForOrganization(organizationId),
          isActive: true,
        },
      }));

    await db.organizationUser.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
      create: {
        organizationId: organization.id,
        userId: user.id,
        role: 'owner',
        joinedAt: new Date(),
        isActive: true,
      },
      update: {
        role: 'owner',
        joinedAt: new Date(),
        isActive: true,
      },
    });

    console.log('Seeding active Pro subscription...');
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1);
    const existingSubscription = await db.subscription.findFirst({
      where: { organizationId: organization.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
    if (existingSubscription) {
      await db.subscription.update({
        where: { id: existingSubscription.id },
        data: {
          planId: proPlan.id,
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    } else {
      await db.subscription.create({
        data: {
          organizationId: organization.id,
          planId: proPlan.id,
          status: 'active',
          paymentReference: `seed_${randomUUID()}`,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
    }

    console.log(`Provisioning tenant schema "${organization.schemaName}"...`);
    await tenant.provisionTenantSchema(organization.schemaName);
    await tenant.seedChartOfAccounts(
      organization.schemaName,
      organization.industry,
    );

    const ctx: TenantContext = {
      organizationId: organization.id,
      schemaName: organization.schemaName,
      role: 'owner',
      permissions: [],
    };

    console.log('Seeding chart of accounts additions...');
    const accounts = await seedAccounts(db, accounting, ctx);
    const bankAccountId = await seedBankAccount(
      db,
      tenant,
      ctx,
      accounts.bank,
    );

    console.log('Seeding customers and vendors...');
    const customers = await seedCustomers(accounting, ctx, user.id);
    const vendors = await seedVendors(accounting, ctx, user.id);

    if (await hasDemoTransactions(db, tenant, ctx)) {
      console.log('Demo transactions already exist; skipping transaction seed.');
    } else {
      console.log('Seeding demo transactions...');
      await seedTransactions(accounting, ctx, user.id, {
        customers,
        vendors,
        accounts,
        bankAccountId,
      });
    }

    console.log('');
    console.log('Seed completed successfully.');
    console.log('---------------------------------------------');
    console.log(`Organization : ${organization.name}`);
    console.log(`Tenant schema: ${organization.schemaName}`);
    console.log(`Owner login  : ${DEMO_OWNER_EMAIL}`);
    console.log(`Password     : ${DEMO_OWNER_PASSWORD}`);
    console.log('---------------------------------------------');
  } finally {
    await app.close();
  }
}

function stopScheduledJobs(app: { get: Function }) {
  try {
    const scheduler = app.get(SchedulerRegistry, { strict: false });
    scheduler.getCronJobs().forEach((job: { stop: () => void }) => job.stop());
  } catch {
    // The seed can run without the scheduler module in tests or stripped builds.
  }
}

async function seedAccounts(
  db: DataBaseService,
  accounting: AccountingService,
  ctx: TenantContext,
): Promise<SeedAccounts> {
  const currentAssets = await firstAccountId(db, ctx, '1100');
  const operatingExpenses = await firstAccountId(db, ctx, '5200');

  const cash = await upsertAccountSafe(accounting, ctx, {
    code: '1130',
    name: 'Cash on Hand',
    type: 'Asset',
    parentId: currentAssets,
  });
  const bank = await upsertAccountSafe(accounting, ctx, {
    code: '1141',
    name: 'CIB Bank - Main Account',
    type: 'Asset',
    parentId: currentAssets,
  });
  const revenue = await firstAccountId(db, ctx, '4100');

  const rent = await upsertAccountSafe(accounting, ctx, {
    code: '5211',
    name: 'Rent Expense',
    type: 'Expense',
    parentId: operatingExpenses,
  });
  const hospitality = await upsertAccountSafe(accounting, ctx, {
    code: '5212',
    name: 'Hospitality and Refreshments',
    type: 'Expense',
    parentId: operatingExpenses,
  });
  const salaries = await upsertAccountSafe(accounting, ctx, {
    code: '5213',
    name: 'Salaries and Wages',
    type: 'Expense',
    parentId: operatingExpenses,
  });
  const bankCharges = await upsertAccountSafe(accounting, ctx, {
    code: '5214',
    name: 'Bank Charges',
    type: 'Expense',
    parentId: operatingExpenses,
  });
  const utilities = await upsertAccountSafe(accounting, ctx, {
    code: '5215',
    name: 'Utilities',
    type: 'Expense',
    parentId: operatingExpenses,
  });
  const transportation = await upsertAccountSafe(accounting, ctx, {
    code: '5216',
    name: 'Transportation',
    type: 'Expense',
    parentId: operatingExpenses,
  });
  const supplies = await upsertAccountSafe(accounting, ctx, {
    code: '5217',
    name: 'Office Supplies and Printing',
    type: 'Expense',
    parentId: operatingExpenses,
  });
  const professionalFees = await upsertAccountSafe(accounting, ctx, {
    code: '5218',
    name: 'Professional and Translation Fees',
    type: 'Expense',
    parentId: operatingExpenses,
  });
  const maintenance = await upsertAccountSafe(accounting, ctx, {
    code: '5219',
    name: 'Maintenance',
    type: 'Expense',
    parentId: operatingExpenses,
  });
  const benefits = await upsertAccountSafe(accounting, ctx, {
    code: '5220',
    name: 'Medical and Employee Benefits',
    type: 'Expense',
    parentId: operatingExpenses,
  });

  return {
    cash,
    bank,
    revenue,
    rent,
    hospitality,
    salaries,
    bankCharges,
    utilities,
    transportation,
    supplies,
    professionalFees,
    maintenance,
    benefits,
  };
}

async function seedBankAccount(
  db: DataBaseService,
  tenant: TenantService,
  ctx: TenantContext,
  glAccountId: string,
): Promise<string> {
  const schema = tenant.quote(ctx.schemaName);
  const existing = await db.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM ${schema}.bank_accounts WHERE account_number = $1 LIMIT 1`,
    '100245678901',
  );
  if (existing[0]) return existing[0].id;

  const rows = await db.$queryRawUnsafe<{ id: string }[]>(
    `INSERT INTO ${schema}.bank_accounts
       (name, account_number, bank_name, currency, gl_account_id)
     VALUES ($1, $2, $3, $4, $5::uuid)
     RETURNING id`,
    'Main Operating Account',
    '100245678901',
    'CIB',
    DEMO_ORG_CURRENCY,
    glAccountId,
  );
  return rows[0].id;
}

async function seedCustomers(
  accounting: AccountingService,
  ctx: TenantContext,
  userId: string,
): Promise<SeededParty[]> {
  const existing = (await accounting.listCustomers(ctx)) as SeededParty[];
  if (existing.length) return existing;

  const definitions = [
    {
      name: 'Hazem Bahgat Law & Legal Consultancy',
      email: 'accounts@hazembahgat-legal.example.com',
      phone: '+20 100 111 2233',
      address: '14 Tahrir Square, Cairo, Egypt',
    },
    {
      name: 'Nile Retail Trading LLC',
      email: 'finance@nileretail.example.com',
      phone: '+20 100 222 3344',
      address: '9 Industrial Zone, 6th of October City, Giza, Egypt',
    },
    {
      name: 'Delta Construction Group',
      email: 'ap@deltaconstruction.example.com',
      phone: '+20 100 333 4455',
      address: '21 Korniche El Nile, Alexandria, Egypt',
    },
    {
      name: 'Cairo TechWorks SaaS',
      email: 'billing@cairotechworks.example.com',
      phone: '+20 100 444 5566',
      address: 'Smart Village, Building B12, Giza, Egypt',
    },
  ];

  const created: SeededParty[] = [];
  for (const customer of definitions) {
    const result = await accounting.createCustomer(ctx, userId, customer);
    created.push({ id: result.id, name: customer.name });
  }
  return created;
}

async function seedVendors(
  accounting: AccountingService,
  ctx: TenantContext,
  userId: string,
): Promise<SeededParty[]> {
  const existing = (await accounting.listVendors(ctx)) as SeededParty[];
  if (existing.length) return existing;

  const definitions = [
    {
      name: 'Al-Tabaa Office Supplies',
      email: 'sales@altabaa-supplies.example.com',
      phone: '+20 102 111 9988',
      address: 'Downtown, Cairo, Egypt',
    },
    {
      name: 'Cairo Translation Services',
      email: 'projects@cairotranslation.example.com',
      phone: '+20 102 222 8877',
      address: 'Mohandessin, Giza, Egypt',
    },
    {
      name: 'Green Buffet Catering',
      email: 'orders@greenbuffet.example.com',
      phone: '+20 102 333 7766',
      address: 'Heliopolis, Cairo, Egypt',
    },
    {
      name: 'Misr Property Management',
      email: 'leasing@misrproperty.example.com',
      phone: '+20 102 444 6655',
      address: 'New Cairo, Cairo, Egypt',
    },
  ];

  const created: SeededParty[] = [];
  for (const vendor of definitions) {
    const result = await accounting.createVendor(ctx, userId, vendor);
    created.push({ id: result.id, name: vendor.name });
  }
  return created;
}

async function seedTransactions(
  accounting: AccountingService,
  ctx: TenantContext,
  userId: string,
  input: {
    customers: SeededParty[];
    vendors: SeededParty[];
    accounts: SeedAccounts;
    bankAccountId: string;
  },
) {
  const [lawFirm, retailer, constructionCo, saasCo] = input.customers;
  const [officeSupplies, translationCo, buffetCo, propertyMgmt] = input.vendors;
  const { accounts, bankAccountId } = input;

  for (const monthsBack of [3, 2, 1]) {
    const billDate = daysAgo(monthsBack * 30);
    await accounting.createVendorBill(ctx, userId, {
      type: 'expense',
      vendorId: propertyMgmt.id,
      issueDate: billDate,
      dueDate: billDate,
      status: 'paid',
      paymentMethod: 'bank',
      bankAccountId,
      accountId: accounts.rent,
      relatedAccountId: accounts.bank,
      lines: [
        {
          description: 'Office rent - monthly',
          quantity: 1,
          unitPrice: 16000,
        },
      ],
    });
  }

  for (const monthsBack of [3, 2, 1]) {
    const billDate = daysAgo(monthsBack * 30 - 3);
    await accounting.createVendorBill(ctx, userId, {
      type: 'expense',
      issueDate: billDate,
      dueDate: billDate,
      status: 'paid',
      paymentMethod: 'bank',
      bankAccountId,
      accountId: accounts.bankCharges,
      relatedAccountId: accounts.bank,
      lines: [
        {
          description: 'Bank service charges',
          quantity: 1,
          unitPrice: 25 + monthsBack * 5,
        },
      ],
    });
  }

  const lawFirmInvoiceAmounts = [200000, 250000, 650000, 250000];
  for (let i = 0; i < lawFirmInvoiceAmounts.length; i += 1) {
    const issueDate = daysAgo(85 - i * 22);
    await accounting.createInvoice(ctx, userId, {
      customerId: lawFirm.id,
      issueDate,
      dueDate: plusDays(issueDate, 14),
      status: 'paid',
      paymentMethod: 'bank',
      bankAccountId,
      accountId: accounts.revenue,
      relatedAccountId: accounts.bank,
      lines: [
        {
          description: 'Export sales invoice - legal & consultancy services',
          quantity: 1,
          unitPrice: lawFirmInvoiceAmounts[i],
        },
      ],
    });
  }

  await accounting.createInvoice(ctx, userId, {
    customerId: retailer.id,
    issueDate: daysAgo(40),
    dueDate: daysAgo(10),
    status: 'paid',
    paymentMethod: 'bank',
    bankAccountId,
    accountId: accounts.revenue,
    relatedAccountId: accounts.bank,
    lines: [
      {
        description: 'Retail consulting package',
        quantity: 1,
        unitPrice: 45000,
        taxRate: 14,
      },
    ],
  });

  const constructionInvoiceDate = daysAgo(25);
  const constructionInvoice = await accounting.createInvoice(ctx, userId, {
    customerId: constructionCo.id,
    issueDate: constructionInvoiceDate,
    dueDate: plusDays(constructionInvoiceDate, 30),
    status: 'unpaid',
    accountId: accounts.revenue,
    lines: [
      {
        description: 'Quarterly compliance review',
        quantity: 1,
        unitPrice: 60000,
        taxRate: 14,
      },
    ],
  });
  await accounting.createCustomerPayment(ctx, userId, {
    entityId: constructionInvoice.id,
    amount: Number(constructionInvoice.total),
    paymentMethod: 'bank',
    paymentDate: plusDays(constructionInvoiceDate, 6),
    bankAccountId,
    reference: 'Wire transfer - quarterly compliance review',
  });

  await accounting.createInvoice(ctx, userId, {
    customerId: saasCo.id,
    issueDate: daysAgo(12),
    dueDate: plusDays(daysAgo(12), 30),
    status: 'unpaid',
    accountId: accounts.revenue,
    lines: [
      {
        description: 'Monthly accounting subscription support',
        quantity: 1,
        unitPrice: 9900,
        taxRate: 14,
      },
      {
        description: 'Payroll processing add-on',
        quantity: 1,
        unitPrice: 3500,
        taxRate: 14,
      },
    ],
  });

  for (const monthsBack of [2, 1]) {
    await accounting.createVendorBill(ctx, userId, {
      type: 'expense',
      issueDate: daysAgo(monthsBack * 30 - 1),
      dueDate: daysAgo(monthsBack * 30 - 1),
      status: 'paid',
      paymentMethod: 'cash',
      accountId: accounts.salaries,
      relatedAccountId: accounts.cash,
      lines: [
        {
          description: 'Part-time accountants - weekly shift payroll',
          quantity: 1,
          unitPrice: 5050,
        },
        {
          description: 'Data entry staff payroll',
          quantity: 1,
          unitPrice: 2300,
        },
      ],
    });
  }

  await accounting.createVendorBill(ctx, userId, {
    type: 'expense',
    issueDate: daysAgo(20),
    dueDate: daysAgo(20),
    status: 'paid',
    paymentMethod: 'bank',
    bankAccountId,
    accountId: accounts.salaries,
    relatedAccountId: accounts.bank,
    lines: [
      {
        description: 'Cairo office payroll - mid-month settlement',
        quantity: 1,
        unitPrice: 203623,
      },
    ],
  });

  const hospitalityItems: Array<{
    daysBack: number;
    description: string;
    amount: number;
    method: 'cash' | 'bank';
  }> = [
    { daysBack: 60, description: 'Office breakfast catering', amount: 2980, method: 'bank' },
    { daysBack: 55, description: 'Evening shift staff dinner order', amount: 1655, method: 'cash' },
    { daysBack: 48, description: 'Buffet restock - soft drinks and snacks', amount: 3170, method: 'cash' },
    { daysBack: 35, description: 'Office breakfast catering', amount: 4680, method: 'bank' },
    { daysBack: 22, description: 'Evening shift staff dinner order', amount: 790, method: 'cash' },
    { daysBack: 9, description: 'Office breakfast catering', amount: 5700, method: 'bank' },
  ];
  for (const item of hospitalityItems) {
    await accounting.createVendorBill(ctx, userId, {
      type: 'expense',
      vendorId: buffetCo.id,
      issueDate: daysAgo(item.daysBack),
      dueDate: daysAgo(item.daysBack),
      status: 'paid',
      paymentMethod: item.method,
      bankAccountId: item.method === 'bank' ? bankAccountId : undefined,
      accountId: accounts.hospitality,
      relatedAccountId: item.method === 'bank' ? accounts.bank : accounts.cash,
      lines: [
        {
          description: item.description,
          quantity: 1,
          unitPrice: item.amount,
        },
      ],
    });
  }

  const officeSupplyItems: Array<{
    daysBack: number;
    description: string;
    amount: number;
  }> = [
    { daysBack: 52, description: 'Printer maintenance service', amount: 2675 },
    { daysBack: 38, description: '10 reams of A4 paper', amount: 950 },
    { daysBack: 30, description: 'Office stationery restock', amount: 400 },
    { daysBack: 18, description: 'Printing supplies and toner', amount: 1625 },
  ];
  for (const item of officeSupplyItems) {
    const paid = item.daysBack > 20;
    await accounting.createVendorBill(ctx, userId, {
      type: 'purchase',
      vendorId: officeSupplies.id,
      issueDate: daysAgo(item.daysBack),
      dueDate: plusDays(daysAgo(item.daysBack), 15),
      status: paid ? 'paid' : 'received',
      paymentMethod: paid ? 'cash' : undefined,
      accountId: item.description.includes('maintenance')
        ? accounts.maintenance
        : accounts.supplies,
      relatedAccountId: paid ? accounts.cash : undefined,
      lines: [
        {
          description: item.description,
          quantity: 1,
          unitPrice: item.amount,
        },
      ],
    });
  }

  const lastSupplyBillDate = daysAgo(6);
  const lastSupplyBill = await accounting.createVendorBill(ctx, userId, {
    type: 'purchase',
    vendorId: officeSupplies.id,
    issueDate: lastSupplyBillDate,
    dueDate: plusDays(lastSupplyBillDate, 15),
    status: 'received',
    accountId: accounts.supplies,
    lines: [
      {
        description: 'Batteries and small office equipment',
        quantity: 1,
        unitPrice: 455,
      },
    ],
  });
  await accounting.createVendorPayment(ctx, userId, {
    entityId: lastSupplyBill.id,
    amount: Number(lastSupplyBill.total),
    paymentMethod: 'bank',
    paymentDate: plusDays(lastSupplyBillDate, 2),
    bankAccountId,
    reference: 'Bank transfer - office equipment settlement',
  });

  for (const item of [
    { daysBack: 45, amount: 10800 },
    { daysBack: 33, amount: 28140 },
    { daysBack: 33, amount: 12500 },
  ]) {
    await accounting.createVendorBill(ctx, userId, {
      type: 'purchase',
      vendorId: translationCo.id,
      issueDate: daysAgo(item.daysBack),
      dueDate: plusDays(daysAgo(item.daysBack), 10),
      status: 'paid',
      paymentMethod: 'bank',
      bankAccountId,
      accountId: accounts.professionalFees,
      relatedAccountId: accounts.bank,
      lines: [
        {
          description: 'Document translation services',
          quantity: 1,
          unitPrice: item.amount,
        },
      ],
    });
  }

  const miscExpenses: Array<{
    daysBack: number;
    description: string;
    amount: number;
    method: 'cash' | 'bank';
    accountId: string;
  }> = [
    { daysBack: 58, description: 'Office electricity bill', amount: 4315, method: 'cash', accountId: accounts.utilities },
    { daysBack: 58, description: 'Staff transportation reimbursement', amount: 725, method: 'cash', accountId: accounts.transportation },
    { daysBack: 44, description: 'Landline phone bill', amount: 39, method: 'bank', accountId: accounts.utilities },
    { daysBack: 44, description: 'Mobile phone bill', amount: 127, method: 'bank', accountId: accounts.utilities },
    { daysBack: 27, description: 'Staff transportation reimbursement', amount: 453, method: 'cash', accountId: accounts.transportation },
    { daysBack: 14, description: 'Medical supplies for office first aid', amount: 247, method: 'bank', accountId: accounts.benefits },
    { daysBack: 5, description: 'Employee medical consultation reimbursement', amount: 560, method: 'cash', accountId: accounts.benefits },
  ];
  for (const item of miscExpenses) {
    await accounting.createVendorBill(ctx, userId, {
      type: 'expense',
      issueDate: daysAgo(item.daysBack),
      dueDate: daysAgo(item.daysBack),
      status: 'paid',
      paymentMethod: item.method,
      bankAccountId: item.method === 'bank' ? bankAccountId : undefined,
      accountId: item.accountId,
      relatedAccountId: item.method === 'bank' ? accounts.bank : accounts.cash,
      lines: [
        {
          description: item.description,
          quantity: 1,
          unitPrice: item.amount,
        },
      ],
    });
  }

  const benefitItems: Array<{
    daysBack: number;
    description: string;
    amount: number;
    method: 'cash' | 'bank';
  }> = [
    { daysBack: 62, description: 'Staff allowance settlement', amount: 75000, method: 'bank' },
    { daysBack: 60, description: 'New hire joining bonus - half month', amount: 7500, method: 'cash' },
    { daysBack: 56, description: 'New hire joining bonus - half month', amount: 11000, method: 'bank' },
    { daysBack: 56, description: 'Monthly performance bonus', amount: 19800, method: 'bank' },
  ];
  for (const item of benefitItems) {
    await accounting.createVendorBill(ctx, userId, {
      type: 'expense',
      issueDate: daysAgo(item.daysBack),
      dueDate: daysAgo(item.daysBack),
      status: 'paid',
      paymentMethod: item.method,
      bankAccountId: item.method === 'bank' ? bankAccountId : undefined,
      accountId: accounts.benefits,
      relatedAccountId: item.method === 'bank' ? accounts.bank : accounts.cash,
      lines: [
        {
          description: item.description,
          quantity: 1,
          unitPrice: item.amount,
        },
      ],
    });
  }
}

async function firstAccountId(
  db: DataBaseService,
  ctx: TenantContext,
  code: string,
): Promise<string> {
  const rows = await db.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "${ctx.schemaName}".accounts WHERE code = $1`,
    code,
  );
  if (!rows[0]) {
    throw new Error(`Expected account ${code} to exist`);
  }
  return rows[0].id;
}

async function upsertAccountSafe(
  accounting: AccountingService,
  ctx: TenantContext,
  dto: { code: string; name: string; type: string; parentId?: string },
): Promise<string> {
  const existing = await findAccountByCode(accounting, ctx, dto.code);
  if (existing) return existing;
  const created = await accounting.upsertAccount(ctx, dto);
  return created.id;
}

async function findAccountByCode(
  accounting: AccountingService,
  ctx: TenantContext,
  code: string,
): Promise<string | null> {
  const accounts = (await accounting.listAccounts(ctx)) as Array<{
    id: string;
    code: string;
  }>;
  return accounts.find((account) => account.code === code)?.id ?? null;
}

async function hasDemoTransactions(
  db: DataBaseService,
  tenant: TenantService,
  ctx: TenantContext,
) {
  const schema = tenant.quote(ctx.schemaName);
  const rows = await db.$queryRawUnsafe<{ total: string }[]>(
    `SELECT (
       (SELECT COUNT(*) FROM ${schema}.invoices) +
       (SELECT COUNT(*) FROM ${schema}.vendor_bills)
     )::text AS total`,
  );
  return Number(rows[0]?.total ?? 0) > 0;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });

// import 'dotenv/config';
// import { NestFactory } from '@nestjs/core';
// import * as bcrypt from 'bcrypt';
// import { AppModule } from '../app.module';
// import { DataBaseService } from '../database/database.service';
// import { AccountingService } from '../modules/accounting/accounting.service';
// import { RagIndexService } from '../modules/ai/rag-index.service';
// import {
//   TenantContext,
//   TenantService,
// } from '../modules/tenant/tenant.service';

// const USER_ID = '11111111-1111-4111-8111-111111111111';
// const ORGANIZATION_ID = '22222222-2222-4222-8222-222222222222';
// const EMAIL = 'chatbot.test@hesbtak.local';
// const PASSWORD = 'ChatbotTest123!';

// function date(monthOffset: number, day: number) {
//   const value = new Date();
//   value.setUTCDate(1);
//   value.setUTCMonth(value.getUTCMonth() + monthOffset);
//   value.setUTCDate(day);
//   return value.toISOString().slice(0, 10);
// }

// async function main() {
//   const app = await NestFactory.createApplicationContext(AppModule, {
//     logger: ['error', 'warn', 'log'],
//   });

//   try {
//     const db = app.get(DataBaseService);
//     const tenant = app.get(TenantService);
//     const accounting = app.get(AccountingService);
//     const rag = app.get(RagIndexService);
//     const schemaName = tenant.schemaNameForOrganization(ORGANIZATION_ID);
//     const schema = tenant.quote(schemaName);
//     const passwordHash = await bcrypt.hash(PASSWORD, 12);

//     await db.user.upsert({
//       where: { email: EMAIL },
//       update: {
//         fullName: 'Chatbot Test Owner',
//         passwordHash,
//         isActive: true,
//         emailVerifiedAt: new Date(),
//       },
//       create: {
//         id: USER_ID,
//         fullName: 'Chatbot Test Owner',
//         email: EMAIL,
//         passwordHash,
//         emailVerifiedAt: new Date(),
//       },
//     });

//     await db.organization.upsert({
//       where: { id: ORGANIZATION_ID },
//       update: {
//         name: 'Hesbtak AI Demo Company',
//         industry: 'Software and consulting',
//         currency: 'USD',
//         isActive: true,
//         schemaName,
//       },
//       create: {
//         id: ORGANIZATION_ID,
//         name: 'Hesbtak AI Demo Company',
//         industry: 'Software and consulting',
//         currency: 'USD',
//         schemaName,
//       },
//     });

//     await db.organizationUser.upsert({
//       where: {
//         organizationId_userId: {
//           organizationId: ORGANIZATION_ID,
//           userId: USER_ID,
//         },
//       },
//       update: { role: 'owner', isActive: true, joinedAt: new Date() },
//       create: {
//         organizationId: ORGANIZATION_ID,
//         userId: USER_ID,
//         role: 'owner',
//         joinedAt: new Date(),
//       },
//     });

//     await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
//     await tenant.provisionTenantSchema(schemaName);
//     await tenant.seedChartOfAccounts(schemaName, 'Software and consulting');

//     const ctx: TenantContext = {
//       organizationId: ORGANIZATION_ID,
//       schemaName,
//       role: 'owner',
//     };

//     await accounting.upsertAccount(ctx, {
//       code: '5200',
//       name: 'Marketing',
//       type: 'Expense',
//     });
//     await accounting.upsertAccount(ctx, {
//       code: '5300',
//       name: 'Rent and Utilities',
//       type: 'Expense',
//     });

//     const accounts = await accounting.listAccounts(ctx) as Array<{
//       id: string;
//       code: string;
//     }>;
//     const accountId = (code: string) => {
//       const account = accounts.find((item) => item.code === code);
//       if (!account) throw new Error(`Seed account ${code} was not created`);
//       return account.id;
//     };

//     await accounting.createJournalEntry(ctx, USER_ID, {
//       date: date(-4, 1),
//       description: 'Opening owner capital for chatbot demo',
//       lines: [
//         { accountId: accountId('1000'), debit: 75000, credit: 0 },
//         { accountId: accountId('3000'), debit: 0, credit: 75000 },
//       ],
//     });

//     const acme = await accounting.createCustomer(ctx, USER_ID, {
//       name: 'Acme Digital',
//       email: 'finance@acme.test',
//       address: 'New York',
//     });
//     const nile = await accounting.createCustomer(ctx, USER_ID, {
//       name: 'Nile Retail Group',
//       email: 'accounts@nile-retail.test',
//       address: 'Cairo',
//     });
//     const horizon = await accounting.createCustomer(ctx, USER_ID, {
//       name: 'Horizon Logistics',
//       email: 'billing@horizon.test',
//       address: 'Alexandria',
//     });

//     const aws = await accounting.createVendor(ctx, USER_ID, {
//       name: 'AWS Cloud Services',
//       email: 'billing@aws.test',
//     });
//     const office = await accounting.createVendor(ctx, USER_ID, {
//       name: 'Cairo Office Supplies',
//       email: 'sales@office.test',
//     });
//     const marketing = await accounting.createVendor(ctx, USER_ID, {
//       name: 'Bright Marketing Agency',
//       email: 'finance@bright.test',
//     });

//     const oldInvoice = await accounting.createInvoice(ctx, USER_ID, {
//       customerId: nile.id,
//       issueDate: date(-3, 5),
//       dueDate: date(-3, 25),
//       lines: [
//         {
//           description: 'ERP implementation milestone',
//           quantity: 1,
//           unitPrice: 9000,
//           taxRate: 0,
//         },
//       ],
//     });
//     await accounting.createCustomerPayment(ctx, USER_ID, {
//       entityId: oldInvoice.id,
//       amount: Number(oldInvoice.total),
//       paymentMethod: 'bank_transfer',
//       paymentDate: date(-3, 18),
//       reference: 'SEED-PAY-001',
//     });

//     const paidInvoice = await accounting.createInvoice(ctx, USER_ID, {
//       customerId: nile.id,
//       issueDate: date(-1, 4),
//       dueDate: date(-1, 24),
//       lines: [
//         {
//           description: 'Monthly managed accounting subscription',
//           quantity: 1,
//           unitPrice: 7000,
//           taxRate: 0,
//         },
//       ],
//     });
//     await accounting.createCustomerPayment(ctx, USER_ID, {
//       entityId: paidInvoice.id,
//       amount: Number(paidInvoice.total),
//       paymentMethod: 'bank_transfer',
//       paymentDate: date(-1, 16),
//       reference: 'SEED-PAY-002',
//     });

//     const partialInvoice = await accounting.createInvoice(ctx, USER_ID, {
//       customerId: acme.id,
//       issueDate: date(0, 2),
//       dueDate: date(0, 22),
//       lines: [
//         {
//           description: 'AI finance integration project',
//           quantity: 1,
//           unitPrice: 12000,
//           taxRate: 14,
//         },
//       ],
//     });
//     await accounting.createCustomerPayment(ctx, USER_ID, {
//       entityId: partialInvoice.id,
//       amount: 8000,
//       paymentMethod: 'bank_transfer',
//       paymentDate: date(0, 6),
//       reference: 'SEED-PAY-003',
//     });

//     await accounting.createInvoice(ctx, USER_ID, {
//       customerId: horizon.id,
//       issueDate: date(0, 5),
//       dueDate: date(0, 25),
//       lines: [
//         {
//           description: 'Financial dashboard customization',
//           quantity: 1,
//           unitPrice: 4500,
//           taxRate: 0,
//         },
//       ],
//     });

//     const cloudBill = await accounting.createVendorBill(ctx, USER_ID, {
//       vendorId: aws.id,
//       issueDate: date(0, 1),
//       dueDate: date(0, 20),
//       lines: [
//         {
//           description: 'Cloud infrastructure and model hosting',
//           quantity: 1,
//           unitPrice: 2400,
//           taxRate: 14,
//           accountId: accountId('5100'),
//         },
//       ],
//     });
//     await accounting.createVendorPayment(ctx, USER_ID, {
//       entityId: cloudBill.id,
//       amount: 1200,
//       paymentMethod: 'bank_transfer',
//       paymentDate: date(0, 7),
//       reference: 'SEED-VPAY-001',
//     });

//     await accounting.createVendorBill(ctx, USER_ID, {
//       vendorId: marketing.id,
//       issueDate: date(0, 3),
//       dueDate: date(0, 28),
//       lines: [
//         {
//           description: 'Q2 growth campaign',
//           quantity: 1,
//           unitPrice: 3200,
//           taxRate: 0,
//           accountId: accountId('5200'),
//         },
//       ],
//     });

//     await accounting.createJournalEntry(ctx, USER_ID, {
//       date: date(-2, 10),
//       description: `Office rent and utilities paid to ${office.name}`,
//       lines: [
//         { accountId: accountId('5300'), debit: 1800, credit: 0 },
//         { accountId: accountId('1000'), debit: 0, credit: 1800 },
//       ],
//     });
//     await accounting.createJournalEntry(ctx, USER_ID, {
//       date: date(-1, 12),
//       description: `Developer tools and subscriptions paid to ${aws.name}`,
//       lines: [
//         { accountId: accountId('5100'), debit: 950, credit: 0 },
//         { accountId: accountId('1000'), debit: 0, credit: 950 },
//       ],
//     });
//     await accounting.createJournalEntry(ctx, USER_ID, {
//       date: date(0, 6),
//       description: 'Customer workshop travel',
//       lines: [
//         { accountId: accountId('5000'), debit: 650, credit: 0 },
//         { accountId: accountId('1000'), debit: 0, credit: 650 },
//       ],
//     });

//     const onboarding = [
//       ['business_model', 'B2B SaaS subscriptions and financial consulting'],
//       ['payment_methods', 'Bank transfers and business cards'],
//       ['main_expenses', 'Cloud hosting, marketing, payroll, rent, and travel'],
//     ];
//     for (const [key, answer] of onboarding) {
//       await db.$executeRawUnsafe(
//         `INSERT INTO ${schema}.onboarding_responses (question_key, answer)
//          VALUES ($1, $2)`,
//         key,
//         answer,
//       );
//     }

//     const ragResult = await rag.reindexTenant(ctx);
//     const verification = await db.$queryRawUnsafe<
//       Array<{
//         cash: string;
//         receivables: string;
//         payables: string;
//         revenue: string;
//         expenses: string;
//         net_income: string;
//       }>
//     >(
//       `SELECT
//         COALESCE(SUM(CASE WHEN a.code = '1000' THEN jl.debit - jl.credit ELSE 0 END), 0) AS cash,
//         (SELECT COALESCE(SUM(i.total - COALESCE(p.paid, 0)), 0)
//          FROM ${schema}.invoices i
//          LEFT JOIN (
//            SELECT invoice_id, SUM(amount) AS paid
//            FROM ${schema}.customer_payments GROUP BY invoice_id
//          ) p ON p.invoice_id = i.id
//          WHERE i.status IN ('unpaid', 'partial')) AS receivables,
//         (SELECT COALESCE(SUM(b.total - COALESCE(p.paid, 0)), 0)
//          FROM ${schema}.vendor_bills b
//          LEFT JOIN (
//            SELECT vendor_bill_id, SUM(amount) AS paid
//            FROM ${schema}.vendor_payments GROUP BY vendor_bill_id
//          ) p ON p.vendor_bill_id = b.id
//          WHERE b.status IN ('received', 'partial')) AS payables,
//         COALESCE(SUM(CASE WHEN a.type = 'Revenue' THEN jl.credit - jl.debit ELSE 0 END), 0) AS revenue,
//         COALESCE(SUM(CASE WHEN a.type = 'Expense' THEN jl.debit - jl.credit ELSE 0 END), 0) AS expenses,
//         COALESCE(SUM(CASE WHEN a.type = 'Revenue' THEN jl.credit - jl.debit ELSE 0 END), 0)
//           - COALESCE(SUM(CASE WHEN a.type = 'Expense' THEN jl.debit - jl.credit ELSE 0 END), 0) AS net_income
//        FROM ${schema}.accounts a
//        LEFT JOIN ${schema}.journal_lines jl ON jl.account_id = a.id`,
//     );

//     console.log(
//       JSON.stringify(
//         {
//           login: { email: EMAIL, password: PASSWORD },
//           organizationId: ORGANIZATION_ID,
//           schemaName,
//           financials: verification[0],
//           rag: ragResult,
//         },
//         null,
//         2,
//       ),
//     );
//   } finally {
//     await app.close();
//   }
// }

// main().catch((error) => {
//   console.error(error);
//   process.exitCode = 1;
// });

import { BadRequestException, Injectable } from '@nestjs/common';
import { DataBaseService } from '../../database/database.service';
import { TenantContext, TenantService } from '../tenant/tenant.service';
import {
  AccountDto, AttachInvoiceDto, InvoiceDto, JournalEntryDto,
  JournalLineDto, PartyDto, PaymentDto, ReturnDto, VendorBillDto, VoucherDto,
} from './dto';

export interface IdRow { id: string; }
export interface TotalRow { total: string; }

@Injectable()
export class AccountingService {
  constructor(
    private readonly db: DataBaseService,
    private readonly tenant: TenantService,
  ) {}

  // ─── Accounts ──────────────────────────────────────────────────────

  async listAccounts(ctx: TenantContext) {
    const schema = this.tenant.quote(ctx.schemaName);
    return this.db.$queryRawUnsafe(`SELECT * FROM ${schema}.accounts ORDER BY code ASC`);
  }

  async upsertAccount(ctx: TenantContext, dto: AccountDto) {
    const schema = this.tenant.quote(ctx.schemaName);
    if (dto.parentId) {
      const parentRows = await this.db.$queryRawUnsafe<{ type: string; level: number }[]>(
        `SELECT type, level FROM ${schema}.accounts WHERE id = $1::uuid`, dto.parentId,
      );
      if (!parentRows[0]) throw new BadRequestException('Parent account not found');
      if (parentRows[0].level >= 4) throw new BadRequestException('Accounts can only be nested up to level 4');
      if (parentRows[0].type !== dto.type) throw new BadRequestException('Child account type must match its parent account type');
    }
    const rows = await this.db.$queryRawUnsafe<IdRow[]>(
      `INSERT INTO ${schema}.accounts (code, name, type, parent_id, level)
       VALUES ($1, $2, $3, $4::uuid, COALESCE((SELECT level + 1 FROM ${schema}.accounts WHERE id = $4::uuid), 1))
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, parent_id = EXCLUDED.parent_id, level = EXCLUDED.level
       RETURNING id`,
      dto.code, dto.name, dto.type, dto.parentId ?? null,
    );
    return rows[0];
  }

  async deleteAccount(ctx: TenantContext, accountId: string) {
    const schema = this.tenant.quote(ctx.schemaName);
    const usageRows = await this.db.$queryRawUnsafe<TotalRow[]>(
      `WITH RECURSIVE branch AS (
        SELECT id FROM ${schema}.accounts WHERE id = $1::uuid
        UNION ALL SELECT child.id FROM ${schema}.accounts child INNER JOIN branch parent ON child.parent_id = parent.id
      ) SELECT (
        (SELECT COUNT(*) FROM ${schema}.journal_lines WHERE account_id IN (SELECT id FROM branch)) +
        (SELECT COUNT(*) FROM ${schema}.invoice_lines WHERE revenue_account_id IN (SELECT id FROM branch)) +
        (SELECT COUNT(*) FROM ${schema}.vendor_bill_lines WHERE expense_account_id IN (SELECT id FROM branch)) +
        (SELECT COUNT(*) FROM ${schema}.expenses WHERE expense_account_id IN (SELECT id FROM branch)) +
        (SELECT COUNT(*) FROM ${schema}.bank_accounts WHERE gl_account_id IN (SELECT id FROM branch))
      )::text AS total`, accountId,
    );
    if (Number(usageRows[0]?.total ?? 0) > 0) {
      throw new BadRequestException('This account or one of its child accounts is used by existing records and cannot be deleted');
    }
    const rows = await this.db.$queryRawUnsafe<IdRow[]>(
      `WITH RECURSIVE branch AS (
        SELECT id FROM ${schema}.accounts WHERE id = $1::uuid
        UNION ALL SELECT child.id FROM ${schema}.accounts child INNER JOIN branch parent ON child.parent_id = parent.id
      ) DELETE FROM ${schema}.accounts WHERE id IN (SELECT id FROM branch) RETURNING id`, accountId,
    );
    if (!rows[0]) throw new BadRequestException('Account not found');
    return { deleted: true };
  }

  // ─── Customers / Vendors ──────────────────────────────────────────

  async createCustomer(ctx: TenantContext, userId: string, dto: PartyDto) {
    return this.insertParty(ctx, userId, 'customers', dto);
  }

  async createVendor(ctx: TenantContext, userId: string, dto: PartyDto) {
    return this.insertParty(ctx, userId, 'vendors', dto);
  }

  async listCustomers(ctx: TenantContext) { return this.listTable(ctx, 'customers'); }
  async listVendors(ctx: TenantContext) { return this.listTable(ctx, 'vendors'); }

  async resolveCustomer(ctx: TenantContext, userId: string, dto: { id?: string; name?: string; email?: string }): Promise<string> {
    if (dto.id) {
      await this.ensurePartyExists(ctx, 'customers', dto.id, 'Customer');
      return dto.id;
    }
    if (dto.name) {
      const customer = await this.createCustomer(ctx, userId, { name: dto.name, email: dto.email });
      return customer.id;
    }
    throw new BadRequestException('customerId or customerInfo.name is required');
  }

  async resolveVendor(ctx: TenantContext, userId: string, dto: { id?: string; name?: string; email?: string }): Promise<string> {
    if (dto.id) {
      await this.ensurePartyExists(ctx, 'vendors', dto.id, 'Vendor');
      return dto.id;
    }
    if (dto.name) {
      const vendor = await this.createVendor(ctx, userId, { name: dto.name, email: dto.email });
      return vendor.id;
    }
    throw new BadRequestException('vendorId or vendorInfo.name is required');
  }

  // ─── Journal Entries ──────────────────────────────────────────────

  async createJournalEntry(
    ctx: TenantContext, userId: string, dto: JournalEntryDto,
    referenceType?: string, referenceId?: string,
  ): Promise<IdRow> {
    this.ensureBalanced(dto.lines);
    const schema = this.tenant.quote(ctx.schemaName);
    const entries = await this.db.$queryRawUnsafe<IdRow[]>(
      `INSERT INTO ${schema}.journal_entries (date, description, status, reference_type, reference_id, created_by)
       VALUES ($1::date, $2, $3, $4, $5::uuid, $6::uuid) RETURNING id`,
      dto.date, dto.description, dto.status ?? 'posted', referenceType ?? null, referenceId ?? null, userId,
    );
    for (const line of dto.lines) {
      await this.db.$executeRawUnsafe(
        `INSERT INTO ${schema}.journal_lines (journal_entry_id, account_id, debit, credit, description)
         VALUES ($1::uuid, $2::uuid, $3, $4, $5)`,
        entries[0].id, line.accountId, line.debit ?? 0, line.credit ?? 0, line.description ?? null,
      );
    }
    return entries[0];
  }

  async listJournalEntries(ctx: TenantContext) {
    const schema = this.tenant.quote(ctx.schemaName);
    return this.db.$queryRawUnsafe(
      `SELECT je.*, COALESCE(json_agg(jl.*) FILTER (WHERE jl.id IS NOT NULL), '[]') AS lines
       FROM ${schema}.journal_entries je
       LEFT JOIN ${schema}.journal_lines jl ON jl.journal_entry_id = je.id
       GROUP BY je.id ORDER BY je.date DESC, je.created_at DESC`,
    );
  }

  async deleteJournalEntry(ctx: TenantContext, journalEntryId: string) {
    const schema = this.tenant.quote(ctx.schemaName);
    const entryRows = await this.db.$queryRawUnsafe<IdRow[]>(
      `SELECT id FROM ${schema}.journal_entries WHERE id = $1::uuid`, journalEntryId,
    );
    if (!entryRows[0]) throw new BadRequestException('Journal entry not found');
    const usageRows = await this.db.$queryRawUnsafe<TotalRow[]>(
      `SELECT (
        (SELECT COUNT(*) FROM ${schema}.invoices WHERE journal_entry_id = $1::uuid) +
        (SELECT COUNT(*) FROM ${schema}.customer_payments WHERE journal_entry_id = $1::uuid) +
        (SELECT COUNT(*) FROM ${schema}.vendor_bills WHERE journal_entry_id = $1::uuid) +
        (SELECT COUNT(*) FROM ${schema}.vendor_payments WHERE journal_entry_id = $1::uuid) +
        (SELECT COUNT(*) FROM ${schema}.expenses WHERE journal_entry_id = $1::uuid) +
        (SELECT COUNT(*) FROM ${schema}.sales_returns WHERE journal_entry_id = $1::uuid) +
        (SELECT COUNT(*) FROM ${schema}.purchase_returns WHERE journal_entry_id = $1::uuid)
      )::text AS total`, journalEntryId,
    );
    if (Number(usageRows[0]?.total ?? 0) > 0) {
      throw new BadRequestException('This journal entry is linked to financial records and cannot be deleted. Delete or reverse the source transaction instead.');
    }
    await this.db.$executeRawUnsafe(
      `UPDATE ${schema}.recurring_entry_logs SET journal_entry_id = NULL WHERE journal_entry_id = $1::uuid`, journalEntryId,
    );
    const deletedRows = await this.db.$queryRawUnsafe<IdRow[]>(
      `DELETE FROM ${schema}.journal_entries WHERE id = $1::uuid RETURNING id`, journalEntryId,
    );
    if (!deletedRows[0]) throw new BadRequestException('Journal entry not found');
    return { deleted: true };
  }

  // ─── Attach Invoice to Journal Entry (manual invoice - kept for legacy) ─

  async attachInvoiceToJournalEntry(ctx: TenantContext, userId: string, journalEntryId: string, dto: AttachInvoiceDto) {
    const invoice = await this.createInvoice(ctx, userId, dto, journalEntryId);
    if (dto.status !== 'paid' && dto.status !== 'draft') {
      await this.createCustomerPayment(ctx, userId, {
        entityId: invoice.id, amount: Number(invoice.total),
        paymentMethod: 'cash', paymentDate: dto.issueDate,
        notes: 'Auto-created cash sale payment from attached invoice',
      }, 'receipt_voucher');
    }
    return invoice;
  }

  // ─── Vouchers (Expense / Receipt) ─────────────────────────────────

  async createVoucher(ctx: TenantContext, userId: string, dto: VoucherDto) {
    if (dto.type === 'receipt') {
      const customerId = await this.resolveCustomer(ctx, userId, {
        id: dto.partyId, name: dto.partyInfo?.name, email: dto.partyInfo?.email,
      });
      const payment = await this.createCustomerPayment(ctx, userId, {
        entityId: dto.invoiceId, partyId: customerId, partyType: 'customer',
        amount: dto.amount, paymentMethod: dto.paymentMethod ?? 'cash',
        paymentDate: dto.date, bankAccountId: dto.bankAccountId,
        notes: dto.description || 'Receipt voucher',
      }, 'receipt_voucher');
      return { id: payment.id, journalEntryId: payment.journalEntryId, type: 'receipt_voucher' };
    }

    const vendorId = await this.resolveVendor(ctx, userId, {
      id: dto.partyId, name: dto.partyInfo?.name, email: dto.partyInfo?.email,
    });
    const payment = await this.createVendorPayment(ctx, userId, {
      entityId: dto.invoiceId, partyId: vendorId, partyType: 'vendor',
      amount: dto.amount, paymentMethod: dto.paymentMethod ?? 'cash',
      paymentDate: dto.date, bankAccountId: dto.bankAccountId,
      notes: dto.description || 'Expense voucher',
    }, 'expense_voucher');
    return { id: payment.id, journalEntryId: payment.journalEntryId, type: 'expense_voucher' };
  }

  // ─── Invoices ─────────────────────────────────────────────────────

  async createInvoice(ctx: TenantContext, userId: string, dto: InvoiceDto, existingJournalEntryId?: string) {
    const schema = this.tenant.quote(ctx.schemaName);
    this.ensureValidDocumentDates(dto.issueDate, dto.dueDate);
    const customerId = await this.resolveCustomer(ctx, userId, {
      id: dto.customerId, name: dto.customerInfo?.name, email: dto.customerInfo?.email,
    });

    const totals = this.calculateLines(dto.lines);
    await this.ensureDocumentAccounts(ctx, totals.lines, 'Revenue');
    const number = await this.nextNumber(ctx, 'invoices', 'INV');
    const invoiceRows = await this.db.$queryRawUnsafe<(IdRow & { total: string })[]>(
      `INSERT INTO ${schema}.invoices
       (invoice_number, customer_id, issue_date, due_date, subtotal, tax_amount, total, status, journal_entry_id, created_by)
       VALUES ($1, $2::uuid, $3::date, $4::date, $5, $6, $7, $8, $9::uuid, $10::uuid)
       RETURNING id, total`,
      number, customerId, dto.issueDate, dto.dueDate,
      totals.subtotal, totals.taxAmount, totals.total,
      dto.status ?? 'unpaid', existingJournalEntryId ?? null, userId,
    );
    const invoice = invoiceRows[0];
    const revenueByAccount = new Map<string, number>();
    let lineNumber = 1;
    for (const line of totals.lines) {
      const revenueAccountId = line.accountId!;
      revenueByAccount.set(
        revenueAccountId,
        (revenueByAccount.get(revenueAccountId) ?? 0) + line.lineSubtotal,
      );
      await this.db.$executeRawUnsafe(
        `INSERT INTO ${schema}.invoice_lines
         (invoice_id, line_number, description, quantity, unit_price, discount_amount, tax_rate, line_subtotal, tax_amount, line_total, revenue_account_id)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::uuid)`,
        invoice.id, lineNumber++, line.description, line.quantity, line.unitPrice,
        line.discountAmount, line.taxRate, line.lineSubtotal, line.taxAmount, line.lineTotal,
        revenueAccountId,
      );
    }

    if (!existingJournalEntryId && dto.status !== 'draft') {
      const ar = await this.accountId(ctx, '1100');
      const journalLines: JournalLineDto[] = [
        { accountId: ar, debit: totals.total, credit: 0 },
        ...Array.from(revenueByAccount, ([accountId, amount]) => ({
          accountId, debit: 0, credit: amount,
        })),
      ];
      if (totals.taxAmount > 0) {
        const outputTax = await this.ensureSystemAccount(ctx, '2100', 'Output Tax Payable', 'Liability');
        journalLines.push({ accountId: outputTax, debit: 0, credit: totals.taxAmount });
      }
      const je = await this.createJournalEntry(ctx, userId, {
        date: dto.issueDate, description: `Customer invoice ${number}`,
        lines: journalLines,
      }, 'invoice', invoice.id);
      await this.db.$executeRawUnsafe(
        `UPDATE ${schema}.invoices SET journal_entry_id = $1::uuid WHERE id = $2::uuid`, je.id, invoice.id,
      );
    }

    if (dto.status === 'paid') {
      await this.createCustomerPayment(ctx, userId, {
        entityId: invoice.id, amount: Number(invoice.total),
        paymentMethod: dto.paymentMethod ?? 'cash', paymentDate: dto.issueDate,
        bankAccountId: dto.bankAccountId, notes: 'Auto payment for invoice',
      }, 'receipt_voucher');
    }

    await this.createAlert(ctx, 'due_date', 'info', 'Invoice due date scheduled', `Invoice ${number} is due on ${dto.dueDate}`, 'invoice', invoice.id);
    return { id: invoice.id, invoiceNumber: number, total: invoice.total, status: dto.status ?? 'unpaid' };
  }

  async listInvoices(ctx: TenantContext) {
    const schema = this.tenant.quote(ctx.schemaName);
    return this.db.$queryRawUnsafe(
      `SELECT i.*, c.name AS customer_name,
        COALESCE((SELECT SUM(cp.amount) FROM ${schema}.customer_payments cp WHERE cp.invoice_id = i.id), 0) AS paid_amount
       FROM ${schema}.invoices i
       JOIN ${schema}.customers c ON c.id = i.customer_id
       ORDER BY i.created_at DESC`,
    );
  }

  async getInvoice(ctx: TenantContext, invoiceId: string) {
    const schema = this.tenant.quote(ctx.schemaName);
    const rows = await this.db.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT i.*, c.name AS customer_name,
        COALESCE(json_agg(il.* ORDER BY il.line_number) FILTER (WHERE il.id IS NOT NULL), '[]') AS lines,
        COALESCE((SELECT SUM(cp.amount) FROM ${schema}.customer_payments cp WHERE cp.invoice_id = i.id), 0) AS paid_amount
       FROM ${schema}.invoices i
       JOIN ${schema}.customers c ON c.id = i.customer_id
       LEFT JOIN ${schema}.invoice_lines il ON il.invoice_id = i.id
       WHERE i.id = $1::uuid
       GROUP BY i.id, c.name`,
      invoiceId,
    );
    if (!rows[0]) throw new BadRequestException('Invoice not found');
    return rows[0];
  }

  async updateInvoice(ctx: TenantContext, userId: string, invoiceId: string, dto: InvoiceDto) {
    const schema = this.tenant.quote(ctx.schemaName);
    const existingRows = await this.db.$queryRawUnsafe<{
      id: string; invoice_number: string; journal_entry_id: string | null; payment_count: string;
    }[]>(
      `SELECT i.id, i.invoice_number, i.journal_entry_id,
        (SELECT COUNT(*)::text FROM ${schema}.customer_payments cp WHERE cp.invoice_id = i.id) AS payment_count
       FROM ${schema}.invoices i WHERE i.id = $1::uuid`,
      invoiceId,
    );
    const existing = existingRows[0];
    if (!existing) throw new BadRequestException('Invoice not found');
    if (Number(existing.payment_count) > 0) {
      throw new BadRequestException('Invoices with payments cannot be edited. Reverse the payment first.');
    }

    this.ensureValidDocumentDates(dto.issueDate, dto.dueDate);
    const customerId = await this.resolveCustomer(ctx, userId, {
      id: dto.customerId, name: dto.customerInfo?.name, email: dto.customerInfo?.email,
    });
    const totals = this.calculateLines(dto.lines);
    await this.ensureDocumentAccounts(ctx, totals.lines, 'Revenue');
    const status = dto.status ?? 'unpaid';

    if (existing.journal_entry_id) {
      await this.db.$executeRawUnsafe(
        `UPDATE ${schema}.invoices SET journal_entry_id = NULL WHERE id = $1::uuid`, invoiceId,
      );
      await this.db.$executeRawUnsafe(
        `DELETE FROM ${schema}.journal_entries WHERE id = $1::uuid`, existing.journal_entry_id,
      );
    }
    await this.db.$executeRawUnsafe(`DELETE FROM ${schema}.invoice_lines WHERE invoice_id = $1::uuid`, invoiceId);
    await this.db.$executeRawUnsafe(
      `UPDATE ${schema}.invoices
       SET customer_id = $1::uuid, issue_date = $2::date, due_date = $3::date,
           subtotal = $4, tax_amount = $5, total = $6, status = $7
       WHERE id = $8::uuid`,
      customerId, dto.issueDate, dto.dueDate, totals.subtotal, totals.taxAmount, totals.total, status, invoiceId,
    );

    const revenueByAccount = new Map<string, number>();
    let lineNumber = 1;
    for (const line of totals.lines) {
      const accountId = line.accountId!;
      revenueByAccount.set(accountId, (revenueByAccount.get(accountId) ?? 0) + line.lineSubtotal);
      await this.db.$executeRawUnsafe(
        `INSERT INTO ${schema}.invoice_lines
         (invoice_id, line_number, description, quantity, unit_price, discount_amount, tax_rate, line_subtotal, tax_amount, line_total, revenue_account_id)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::uuid)`,
        invoiceId, lineNumber++, line.description, line.quantity, line.unitPrice,
        line.discountAmount, line.taxRate, line.lineSubtotal, line.taxAmount, line.lineTotal, accountId,
      );
    }

    if (status !== 'draft') {
      const journalLines: JournalLineDto[] = [
        { accountId: await this.accountId(ctx, '1100'), debit: totals.total, credit: 0 },
        ...Array.from(revenueByAccount, ([accountId, amount]) => ({ accountId, debit: 0, credit: amount })),
      ];
      if (totals.taxAmount > 0) {
        journalLines.push({
          accountId: await this.ensureSystemAccount(ctx, '2100', 'Output Tax Payable', 'Liability'),
          debit: 0, credit: totals.taxAmount,
        });
      }
      const journal = await this.createJournalEntry(ctx, userId, {
        date: dto.issueDate,
        description: `Customer invoice ${existing.invoice_number}`,
        lines: journalLines,
      }, 'invoice', invoiceId);
      await this.db.$executeRawUnsafe(
        `UPDATE ${schema}.invoices SET journal_entry_id = $1::uuid WHERE id = $2::uuid`, journal.id, invoiceId,
      );
    }
    if (status === 'paid') {
      await this.createCustomerPayment(ctx, userId, {
        entityId: invoiceId, amount: totals.total, paymentMethod: dto.paymentMethod ?? 'cash',
        paymentDate: dto.issueDate, bankAccountId: dto.bankAccountId, notes: 'Auto payment for invoice',
      }, 'receipt_voucher');
    }
    return this.getInvoice(ctx, invoiceId);
  }

  async deleteInvoice(ctx: TenantContext, invoiceId: string) {
    const schema = this.tenant.quote(ctx.schemaName);
    await this.db.$executeRawUnsafe(`DELETE FROM ${schema}.invoice_lines WHERE invoice_id = $1::uuid`, invoiceId);
    await this.db.$executeRawUnsafe(`DELETE FROM ${schema}.customer_payments WHERE invoice_id = $1::uuid`, invoiceId);
    const rows = await this.db.$queryRawUnsafe<IdRow[]>(
      `DELETE FROM ${schema}.invoices WHERE id = $1::uuid RETURNING id`, invoiceId,
    );
    if (!rows[0]) throw new BadRequestException('Invoice not found');
    return { deleted: true };
  }

  async listUnpaidInvoices(ctx: TenantContext) {
    const schema = this.tenant.quote(ctx.schemaName);
    return this.db.$queryRawUnsafe(
      `SELECT i.*, c.name AS customer_name
       FROM ${schema}.invoices i
       LEFT JOIN ${schema}.customers c ON c.id = i.customer_id
       WHERE i.status IN ('unpaid', 'partial')
       ORDER BY i.due_date ASC`,
    );
  }

  // ─── Vendor Bills ────────────────────────────────────────────────

  async createVendorBill(ctx: TenantContext, userId: string, dto: VendorBillDto) {
    const schema = this.tenant.quote(ctx.schemaName);
    this.ensureValidDocumentDates(dto.issueDate, dto.dueDate);
    const vendorId = await this.resolveVendor(ctx, userId, {
      id: dto.vendorId, name: dto.vendorInfo?.name, email: dto.vendorInfo?.email,
    });

    const totals = this.calculateLines(dto.lines);
    await this.ensureDocumentAccounts(ctx, totals.lines, 'Expense');
    const number = await this.nextNumber(ctx, 'vendor_bills', 'BILL');
    const billRows = await this.db.$queryRawUnsafe<(IdRow & { total: string })[]>(
      `INSERT INTO ${schema}.vendor_bills
       (bill_number, vendor_id, issue_date, due_date, subtotal, tax_amount, total, status, created_by)
       VALUES ($1, $2::uuid, $3::date, $4::date, $5, $6, $7, $8, $9::uuid)
       RETURNING id, total`,
      number, vendorId, dto.issueDate, dto.dueDate,
      totals.subtotal, totals.taxAmount, totals.total,
      dto.status ?? 'received', userId,
    );
    const bill = billRows[0];
    const expenseByAccount = new Map<string, number>();
    let lineNumber = 1;
    for (const line of totals.lines) {
      const expenseAccountId = line.accountId!;
      expenseByAccount.set(
        expenseAccountId,
        (expenseByAccount.get(expenseAccountId) ?? 0) + line.lineSubtotal,
      );
      await this.db.$executeRawUnsafe(
        `INSERT INTO ${schema}.vendor_bill_lines
         (vendor_bill_id, line_number, description, quantity, unit_cost, discount_amount, tax_rate, line_subtotal, tax_amount, line_total, expense_account_id)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::uuid)`,
        bill.id, lineNumber++, line.description, line.quantity, line.unitPrice,
        line.discountAmount, line.taxRate, line.lineSubtotal, line.taxAmount, line.lineTotal,
        expenseAccountId,
      );
    }
    const ap = await this.accountId(ctx, '2000');
    if (dto.status !== 'draft') {
      const journalLines: JournalLineDto[] = [
        ...Array.from(expenseByAccount, ([accountId, amount]) => ({
          accountId, debit: amount, credit: 0,
        })),
      ];
      if (totals.taxAmount > 0) {
        const inputTax = await this.ensureSystemAccount(ctx, '1200', 'Input Tax Receivable', 'Asset');
        journalLines.push({ accountId: inputTax, debit: totals.taxAmount, credit: 0 });
      }
      journalLines.push({ accountId: ap, debit: 0, credit: totals.total });
      const je = await this.createJournalEntry(ctx, userId, {
        date: dto.issueDate, description: `Vendor bill ${number}`,
        lines: journalLines,
      }, 'vendor_bill', bill.id);
      await this.db.$executeRawUnsafe(
        `UPDATE ${schema}.vendor_bills SET journal_entry_id = $1::uuid WHERE id = $2::uuid`, je.id, bill.id,
      );
    }

    if (dto.status === 'paid') {
      await this.createVendorPayment(ctx, userId, {
        entityId: bill.id, amount: Number(bill.total),
        paymentMethod: dto.paymentMethod ?? 'cash', paymentDate: dto.issueDate,
        bankAccountId: dto.bankAccountId, notes: 'Auto payment for bill',
      }, 'expense_voucher');
    }

    await this.createAlert(ctx, 'due_date', 'info', 'Vendor bill due date scheduled', `Bill ${number} is due on ${dto.dueDate}`, 'vendor_bill', bill.id);
    return { id: bill.id, billNumber: number, total: bill.total, status: dto.status ?? 'received' };
  }

  async listVendorBills(ctx: TenantContext) {
    const schema = this.tenant.quote(ctx.schemaName);
    return this.db.$queryRawUnsafe(
      `SELECT b.*, v.name AS vendor_name,
        COALESCE((SELECT SUM(vp.amount) FROM ${schema}.vendor_payments vp WHERE vp.vendor_bill_id = b.id), 0) AS paid_amount
       FROM ${schema}.vendor_bills b
       JOIN ${schema}.vendors v ON v.id = b.vendor_id
       ORDER BY b.created_at DESC`,
    );
  }

  async getVendorBill(ctx: TenantContext, billId: string) {
    const schema = this.tenant.quote(ctx.schemaName);
    const rows = await this.db.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT b.*, v.name AS vendor_name,
        COALESCE(json_agg(vbl.* ORDER BY vbl.line_number) FILTER (WHERE vbl.id IS NOT NULL), '[]') AS lines,
        COALESCE((SELECT SUM(vp.amount) FROM ${schema}.vendor_payments vp WHERE vp.vendor_bill_id = b.id), 0) AS paid_amount
       FROM ${schema}.vendor_bills b
       JOIN ${schema}.vendors v ON v.id = b.vendor_id
       LEFT JOIN ${schema}.vendor_bill_lines vbl ON vbl.vendor_bill_id = b.id
       WHERE b.id = $1::uuid
       GROUP BY b.id, v.name`,
      billId,
    );
    if (!rows[0]) throw new BadRequestException('Vendor bill not found');
    return rows[0];
  }

  async updateVendorBill(ctx: TenantContext, userId: string, billId: string, dto: VendorBillDto) {
    const schema = this.tenant.quote(ctx.schemaName);
    const existingRows = await this.db.$queryRawUnsafe<{
      id: string; bill_number: string; journal_entry_id: string | null; payment_count: string;
    }[]>(
      `SELECT b.id, b.bill_number, b.journal_entry_id,
        (SELECT COUNT(*)::text FROM ${schema}.vendor_payments vp WHERE vp.vendor_bill_id = b.id) AS payment_count
       FROM ${schema}.vendor_bills b WHERE b.id = $1::uuid`,
      billId,
    );
    const existing = existingRows[0];
    if (!existing) throw new BadRequestException('Vendor bill not found');
    if (Number(existing.payment_count) > 0) {
      throw new BadRequestException('Vendor bills with payments cannot be edited. Reverse the payment first.');
    }

    this.ensureValidDocumentDates(dto.issueDate, dto.dueDate);
    const vendorId = await this.resolveVendor(ctx, userId, {
      id: dto.vendorId, name: dto.vendorInfo?.name, email: dto.vendorInfo?.email,
    });
    const totals = this.calculateLines(dto.lines);
    await this.ensureDocumentAccounts(ctx, totals.lines, 'Expense');
    const status = dto.status ?? 'received';

    if (existing.journal_entry_id) {
      await this.db.$executeRawUnsafe(
        `UPDATE ${schema}.vendor_bills SET journal_entry_id = NULL WHERE id = $1::uuid`, billId,
      );
      await this.db.$executeRawUnsafe(
        `DELETE FROM ${schema}.journal_entries WHERE id = $1::uuid`, existing.journal_entry_id,
      );
    }
    await this.db.$executeRawUnsafe(`DELETE FROM ${schema}.vendor_bill_lines WHERE vendor_bill_id = $1::uuid`, billId);
    await this.db.$executeRawUnsafe(
      `UPDATE ${schema}.vendor_bills
       SET vendor_id = $1::uuid, issue_date = $2::date, due_date = $3::date,
           subtotal = $4, tax_amount = $5, total = $6, status = $7
       WHERE id = $8::uuid`,
      vendorId, dto.issueDate, dto.dueDate, totals.subtotal, totals.taxAmount, totals.total, status, billId,
    );

    const expenseByAccount = new Map<string, number>();
    let lineNumber = 1;
    for (const line of totals.lines) {
      const accountId = line.accountId!;
      expenseByAccount.set(accountId, (expenseByAccount.get(accountId) ?? 0) + line.lineSubtotal);
      await this.db.$executeRawUnsafe(
        `INSERT INTO ${schema}.vendor_bill_lines
         (vendor_bill_id, line_number, description, quantity, unit_cost, discount_amount, tax_rate, line_subtotal, tax_amount, line_total, expense_account_id)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::uuid)`,
        billId, lineNumber++, line.description, line.quantity, line.unitPrice,
        line.discountAmount, line.taxRate, line.lineSubtotal, line.taxAmount, line.lineTotal, accountId,
      );
    }

    if (status !== 'draft') {
      const journalLines: JournalLineDto[] = [
        ...Array.from(expenseByAccount, ([accountId, amount]) => ({ accountId, debit: amount, credit: 0 })),
      ];
      if (totals.taxAmount > 0) {
        journalLines.push({
          accountId: await this.ensureSystemAccount(ctx, '1200', 'Input Tax Receivable', 'Asset'),
          debit: totals.taxAmount, credit: 0,
        });
      }
      journalLines.push({ accountId: await this.accountId(ctx, '2000'), debit: 0, credit: totals.total });
      const journal = await this.createJournalEntry(ctx, userId, {
        date: dto.issueDate,
        description: `Vendor bill ${existing.bill_number}`,
        lines: journalLines,
      }, 'vendor_bill', billId);
      await this.db.$executeRawUnsafe(
        `UPDATE ${schema}.vendor_bills SET journal_entry_id = $1::uuid WHERE id = $2::uuid`, journal.id, billId,
      );
    }
    if (status === 'paid') {
      await this.createVendorPayment(ctx, userId, {
        entityId: billId, amount: totals.total, paymentMethod: dto.paymentMethod ?? 'cash',
        paymentDate: dto.issueDate, bankAccountId: dto.bankAccountId, notes: 'Auto payment for bill',
      }, 'expense_voucher');
    }
    return this.getVendorBill(ctx, billId);
  }

  async deleteVendorBill(ctx: TenantContext, billId: string) {
    const schema = this.tenant.quote(ctx.schemaName);
    await this.db.$executeRawUnsafe(`DELETE FROM ${schema}.vendor_bill_lines WHERE vendor_bill_id = $1::uuid`, billId);
    await this.db.$executeRawUnsafe(`DELETE FROM ${schema}.vendor_payments WHERE vendor_bill_id = $1::uuid`, billId);
    const rows = await this.db.$queryRawUnsafe<IdRow[]>(
      `DELETE FROM ${schema}.vendor_bills WHERE id = $1::uuid RETURNING id`, billId,
    );
    if (!rows[0]) throw new BadRequestException('Vendor bill not found');
    return { deleted: true };
  }

  async listUnpaidBills(ctx: TenantContext) {
    const schema = this.tenant.quote(ctx.schemaName);
    return this.db.$queryRawUnsafe(
      `SELECT b.*, v.name AS vendor_name
       FROM ${schema}.vendor_bills b
       LEFT JOIN ${schema}.vendors v ON v.id = b.vendor_id
       WHERE b.status IN ('received', 'partial')
       ORDER BY b.due_date ASC`,
    );
  }

  // ─── Customer Payments ────────────────────────────────────────────

  async createCustomerPayment(ctx: TenantContext, userId: string, dto: PaymentDto, referenceType = 'customer_payment') {
    const schema = this.tenant.quote(ctx.schemaName);

    let invoiceId = dto.entityId;
    let customerId = dto.partyId;

    if (!invoiceId && dto.partyId && dto.partyType === 'customer') {
      const invoices = await this.db.$queryRawUnsafe<IdRow[]>(
        `SELECT id FROM ${schema}.invoices WHERE customer_id = $1::uuid AND status IN ('unpaid', 'partial') ORDER BY due_date ASC LIMIT 1`,
        dto.partyId,
      );
      if (invoices[0]) invoiceId = invoices[0].id;
    }

    if (!invoiceId) throw new BadRequestException('Invoice not found');
    const invoiceRows = await this.db.$queryRawUnsafe<{ id: string; customer_id: string; total: string; paid: string }[]>(
      `SELECT i.id, i.customer_id, i.total,
        COALESCE((SELECT SUM(cp.amount) FROM ${schema}.customer_payments cp WHERE cp.invoice_id = i.id), 0) AS paid
       FROM ${schema}.invoices i WHERE i.id = $1::uuid`, invoiceId,
    );
    if (!invoiceRows[0]) throw new BadRequestException('Invoice not found');
    customerId = invoiceRows[0].customer_id;
    const remaining = Number(invoiceRows[0].total) - Number(invoiceRows[0].paid);
    if (dto.amount <= 0 || dto.amount > remaining + 0.001) {
      throw new BadRequestException(`Payment must be greater than zero and cannot exceed the remaining balance of ${remaining.toFixed(2)}`);
    }

    const cash = dto.bankAccountId ? await this.bankGlAccount(ctx, dto.bankAccountId) : await this.accountId(ctx, '1000');
    const ar = await this.accountId(ctx, '1100');
    const je = await this.createJournalEntry(ctx, userId, {
      date: dto.paymentDate, description: `Customer payment for invoice ${invoiceId}`,
      lines: [
        { accountId: cash, debit: dto.amount, credit: 0 },
        { accountId: ar, debit: 0, credit: dto.amount },
      ],
    }, referenceType, invoiceId);
    const rows = await this.db.$queryRawUnsafe<IdRow[]>(
      `INSERT INTO ${schema}.customer_payments
       (customer_id, invoice_id, amount, payment_method, bank_account_id, payment_date, reference, journal_entry_id, notes, created_by)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6::date, $7, $8::uuid, $9, $10::uuid) RETURNING id`,
      customerId, invoiceId, dto.amount, dto.paymentMethod, dto.bankAccountId ?? null,
      dto.paymentDate, dto.reference ?? null, je.id, dto.notes ?? null, userId,
    );
    await this.updateInvoiceStatus(ctx, invoiceId);
    return { ...rows[0], journalEntryId: je.id };
  }

  async listCustomerPayments(ctx: TenantContext) {
    return this.listTable(ctx, 'customer_payments');
  }

  // ─── Vendor Payments ──────────────────────────────────────────────

  async createVendorPayment(ctx: TenantContext, userId: string, dto: PaymentDto, referenceType = 'vendor_payment') {
    const schema = this.tenant.quote(ctx.schemaName);

    let billId = dto.entityId;
    let vendorId = dto.partyId;

    if (!billId && dto.partyId && dto.partyType === 'vendor') {
      const bills = await this.db.$queryRawUnsafe<IdRow[]>(
        `SELECT id FROM ${schema}.vendor_bills WHERE vendor_id = $1::uuid AND status IN ('received', 'partial') ORDER BY due_date ASC LIMIT 1`,
        dto.partyId,
      );
      if (bills[0]) billId = bills[0].id;
    }

    if (!billId) throw new BadRequestException('Vendor bill not found');
    const billRows = await this.db.$queryRawUnsafe<{ id: string; vendor_id: string; total: string; paid: string }[]>(
      `SELECT b.id, b.vendor_id, b.total,
        COALESCE((SELECT SUM(vp.amount) FROM ${schema}.vendor_payments vp WHERE vp.vendor_bill_id = b.id), 0) AS paid
       FROM ${schema}.vendor_bills b WHERE b.id = $1::uuid`, billId,
    );
    if (!billRows[0]) throw new BadRequestException('Vendor bill not found');
    vendorId = billRows[0].vendor_id;
    const remaining = Number(billRows[0].total) - Number(billRows[0].paid);
    if (dto.amount <= 0 || dto.amount > remaining + 0.001) {
      throw new BadRequestException(`Payment must be greater than zero and cannot exceed the remaining balance of ${remaining.toFixed(2)}`);
    }

    const cash = dto.bankAccountId ? await this.bankGlAccount(ctx, dto.bankAccountId) : await this.accountId(ctx, '1000');
    const ap = await this.accountId(ctx, '2000');
    const je = await this.createJournalEntry(ctx, userId, {
      date: dto.paymentDate, description: `Vendor payment for bill ${billId}`,
      lines: [
        { accountId: ap, debit: dto.amount, credit: 0 },
        { accountId: cash, debit: 0, credit: dto.amount },
      ],
    }, referenceType, billId);
    const rows = await this.db.$queryRawUnsafe<IdRow[]>(
      `INSERT INTO ${schema}.vendor_payments
       (vendor_bill_id, vendor_id, amount, payment_method, bank_account_id, payment_date, reference, journal_entry_id, notes, created_by)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6::date, $7, $8::uuid, $9, $10::uuid) RETURNING id`,
      billId, vendorId, dto.amount, dto.paymentMethod, dto.bankAccountId ?? null,
      dto.paymentDate, dto.reference ?? null, je.id, dto.notes ?? null, userId,
    );
    await this.updateBillStatus(ctx, billId);
    return { ...rows[0], journalEntryId: je.id };
  }

  async listVendorPayments(ctx: TenantContext) {
    return this.listTable(ctx, 'vendor_payments');
  }

  // ─── Returns ──────────────────────────────────────────────────────

  async createSalesReturn(ctx: TenantContext, userId: string, dto: ReturnDto) {
    const schema = this.tenant.quote(ctx.schemaName);

    const invoiceRows = dto.invoiceId
      ? await this.db.$queryRawUnsafe<{ id: string; customer_id: string; total: string }[]>(
          `SELECT id, customer_id, total FROM ${schema}.invoices WHERE id = $1::uuid`, dto.invoiceId,
        )
      : [];
    const customerId = invoiceRows[0]?.customer_id;

    if (!customerId) throw new BadRequestException('Invoice not found or has no customer');

    const totals = this.calculateReturnLines(dto.lines);
    const number = await this.nextNumber(ctx, 'sales_returns', 'SR');
    const revenue = await this.accountId(ctx, '4000');
    const ar = await this.accountId(ctx, '1100');

    const je = await this.createJournalEntry(ctx, userId, {
      date: dto.returnDate, description: `Sales return ${number}: ${dto.reason}`,
      lines: [
        { accountId: revenue, debit: totals.total, credit: 0 },
        { accountId: ar, debit: 0, credit: totals.total },
      ],
    }, 'sales_return');

    const rows = await this.db.$queryRawUnsafe<IdRow[]>(
      `INSERT INTO ${schema}.sales_returns
       (return_number, invoice_id, customer_id, return_date, reason, subtotal, tax_amount, total, journal_entry_id, created_by)
       VALUES ($1, $2::uuid, $3::uuid, $4::date, $5, $6, $7, $8, $9::uuid, $10::uuid) RETURNING id`,
      number, dto.invoiceId ?? null, customerId, dto.returnDate, dto.reason,
      totals.subtotal, totals.taxAmount, totals.total, je.id, userId,
    );
    const ret = rows[0];
    let ln = 1;
    for (const line of totals.lines) {
      await this.db.$executeRawUnsafe(
        `INSERT INTO ${schema}.sales_return_lines
         (sales_return_id, line_number, description, quantity, unit_price, tax_rate, line_subtotal, tax_amount, line_total)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)`,
        ret.id, ln++, line.description, line.quantity, line.unitPrice,
        line.taxRate, line.lineSubtotal, line.taxAmount, line.lineTotal,
      );
    }

    return { id: ret.id, returnNumber: number, total: totals.total };
  }

  async listSalesReturns(ctx: TenantContext) { return this.listTable(ctx, 'sales_returns'); }

  async createPurchaseReturn(ctx: TenantContext, userId: string, dto: ReturnDto) {
    const schema = this.tenant.quote(ctx.schemaName);

    const billRows = dto.billId
      ? await this.db.$queryRawUnsafe<{ id: string; vendor_id: string }[]>(
          `SELECT id, vendor_id FROM ${schema}.vendor_bills WHERE id = $1::uuid`, dto.billId,
        )
      : [];
    const vendorId = billRows[0]?.vendor_id;

    if (!vendorId) throw new BadRequestException('Vendor bill not found or has no vendor');

    const totals = this.calculateReturnLines(dto.lines);
    const number = await this.nextNumber(ctx, 'purchase_returns', 'PR');
    const expense = await this.accountId(ctx, '5000');
    const ap = await this.accountId(ctx, '2000');

    const je = await this.createJournalEntry(ctx, userId, {
      date: dto.returnDate, description: `Purchase return ${number}: ${dto.reason}`,
      lines: [
        { accountId: ap, debit: totals.total, credit: 0 },
        { accountId: expense, debit: 0, credit: totals.total },
      ],
    }, 'purchase_return');

    const rows = await this.db.$queryRawUnsafe<IdRow[]>(
      `INSERT INTO ${schema}.purchase_returns
       (return_number, bill_id, vendor_id, return_date, reason, subtotal, tax_amount, total, journal_entry_id, created_by)
       VALUES ($1, $2::uuid, $3::uuid, $4::date, $5, $6, $7, $8, $9::uuid, $10::uuid) RETURNING id`,
      number, dto.billId ?? null, vendorId, dto.returnDate, dto.reason,
      totals.subtotal, totals.taxAmount, totals.total, je.id, userId,
    );
    const ret = rows[0];
    let ln = 1;
    for (const line of totals.lines) {
      await this.db.$executeRawUnsafe(
        `INSERT INTO ${schema}.purchase_return_lines
         (purchase_return_id, line_number, description, quantity, unit_price, tax_rate, line_subtotal, tax_amount, line_total)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)`,
        ret.id, ln++, line.description, line.quantity, line.unitPrice,
        line.taxRate, line.lineSubtotal, line.taxAmount, line.lineTotal,
      );
    }

    return { id: ret.id, returnNumber: number, total: totals.total };
  }

  async listPurchaseReturns(ctx: TenantContext) { return this.listTable(ctx, 'purchase_returns'); }

  // ─── Alerts ───────────────────────────────────────────────────────

  async createAlert(ctx: TenantContext, type: string, severity: string, title: string, message: string, entityType?: string, entityId?: string) {
    const schema = this.tenant.quote(ctx.schemaName);
    await this.db.$executeRawUnsafe(
      `INSERT INTO ${schema}.alerts (type, severity, title, message, entity_type, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6::uuid)`,
      type, severity, title, message, entityType ?? null, entityId ?? null,
    );
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  private async insertParty(ctx: TenantContext, userId: string, table: 'customers' | 'vendors', dto: PartyDto) {
    const schema = this.tenant.quote(ctx.schemaName);
    const rows = await this.db.$queryRawUnsafe<IdRow[]>(
      `INSERT INTO ${schema}.${table} (name, email, phone, address, created_by)
       VALUES ($1, $2, $3, $4, $5::uuid) RETURNING id`,
      dto.name, dto.email ?? null, dto.phone ?? null, dto.address ?? null, userId,
    );
    return rows[0];
  }

  private async ensurePartyExists(
    ctx: TenantContext,
    table: 'customers' | 'vendors',
    id: string,
    label: string,
  ) {
    const schema = this.tenant.quote(ctx.schemaName);
    const rows = await this.db.$queryRawUnsafe<IdRow[]>(
      `SELECT id FROM ${schema}.${table} WHERE id = $1::uuid AND is_active = true`,
      id,
    );
    if (!rows[0]) throw new BadRequestException(`${label} not found`);
  }

  private async listTable(ctx: TenantContext, table: string) {
    const schema = this.tenant.quote(ctx.schemaName);
    return this.db.$queryRawUnsafe(`SELECT * FROM ${schema}.${table} ORDER BY created_at DESC`);
  }

  private ensureBalanced(lines: JournalLineDto[]) {
    const debit = lines.reduce((sum, line) => sum + Number(line.debit ?? 0), 0);
    const credit = lines.reduce((sum, line) => sum + Number(line.credit ?? 0), 0);
    if (!lines.length || Math.abs(debit - credit) > 0.001) {
      throw new BadRequestException('Journal entry lines must balance');
    }
  }

  private calculateLines(lines: { description: string; quantity: number; unitPrice: number; discountAmount?: number; taxRate?: number; accountId?: string }[]) {
    if (!lines.length) throw new BadRequestException('At least one document line is required');
    const calculated = lines.map((line) => {
      const quantity = Number(line.quantity ?? 1);
      const unitPrice = Number(line.unitPrice);
      const discountAmount = Number(line.discountAmount ?? 0);
      const taxRate = Number(line.taxRate ?? 0);
      const gross = quantity * unitPrice;
      if (!line.description?.trim() || quantity <= 0 || unitPrice < 0 || discountAmount < 0 || discountAmount > gross || taxRate < 0) {
        throw new BadRequestException('Each line requires a description, positive quantity, non-negative price and tax, and a discount no greater than the line amount');
      }
      const lineSubtotal = gross - discountAmount;
      const taxAmount = lineSubtotal * (taxRate / 100);
      return { ...line, quantity, unitPrice, discountAmount, taxRate, lineSubtotal, taxAmount, lineTotal: lineSubtotal + taxAmount };
    });
    return {
      lines: calculated,
      subtotal: calculated.reduce((sum, line) => sum + line.lineSubtotal, 0),
      taxAmount: calculated.reduce((sum, line) => sum + line.taxAmount, 0),
      total: calculated.reduce((sum, line) => sum + line.lineTotal, 0),
    };
  }

  private calculateReturnLines(lines: { description: string; quantity: number; unitPrice: number; taxRate?: number }[]) {
    const calculated = lines.map((line) => {
      const quantity = Number(line.quantity ?? 1);
      const unitPrice = Number(line.unitPrice);
      const taxRate = Number(line.taxRate ?? 0);
      const lineSubtotal = quantity * unitPrice;
      const taxAmount = lineSubtotal * (taxRate / 100);
      return { ...line, quantity, unitPrice, taxRate, lineSubtotal, taxAmount, lineTotal: lineSubtotal + taxAmount };
    });
    return {
      lines: calculated,
      subtotal: calculated.reduce((sum, line) => sum + line.lineSubtotal, 0),
      taxAmount: calculated.reduce((sum, line) => sum + line.taxAmount, 0),
      total: calculated.reduce((sum, line) => sum + line.lineTotal, 0),
    };
  }

  private async accountId(ctx: TenantContext, code: string): Promise<string> {
    const schema = this.tenant.quote(ctx.schemaName);
    const rows = await this.db.$queryRawUnsafe<IdRow[]>(
      `SELECT id FROM ${schema}.accounts WHERE code = $1`, code,
    );
    if (!rows[0]) throw new BadRequestException(`Account ${code} not found`);
    return rows[0].id;
  }

  private async ensureDocumentAccounts(
    ctx: TenantContext,
    lines: { accountId?: string }[],
    expectedType: 'Revenue' | 'Expense',
  ) {
    const accountIds = [...new Set(lines.map((line) => line.accountId).filter((id): id is string => Boolean(id)))];
    if (lines.some((line) => !line.accountId)) {
      throw new BadRequestException(`Select a ${expectedType.toLowerCase()} account for every invoice line`);
    }
    const schema = this.tenant.quote(ctx.schemaName);
    const rows = await this.db.$queryRawUnsafe<{ id: string; type: string; is_active: boolean }[]>(
      `SELECT id, type, is_active FROM ${schema}.accounts WHERE id = ANY($1::uuid[])`,
      accountIds,
    );
    if (
      rows.length !== accountIds.length
      || rows.some((account) => account.type !== expectedType || account.is_active === false)
    ) {
      throw new BadRequestException(`Every line must use an active ${expectedType.toLowerCase()} account`);
    }
  }

  private ensureValidDocumentDates(issueDate: string, dueDate: string) {
    if (dueDate < issueDate) {
      throw new BadRequestException('Due date cannot be before the issue date');
    }
  }

  private async ensureSystemAccount(
    ctx: TenantContext,
    code: string,
    name: string,
    type: string,
  ): Promise<string> {
    const schema = this.tenant.quote(ctx.schemaName);
    const rows = await this.db.$queryRawUnsafe<IdRow[]>(
      `INSERT INTO ${schema}.accounts (code, name, type)
       VALUES ($1, $2, $3)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      code, name, type,
    );
    return rows[0].id;
  }

  private async bankGlAccount(ctx: TenantContext, bankAccountId: string): Promise<string> {
    const schema = this.tenant.quote(ctx.schemaName);
    const rows = await this.db.$queryRawUnsafe<{ gl_account_id: string }[]>(
      `SELECT gl_account_id FROM ${schema}.bank_accounts WHERE id = $1::uuid`, bankAccountId,
    );
    if (!rows[0]) throw new BadRequestException('Bank account not found');
    return rows[0].gl_account_id;
  }

  private async nextNumber(ctx: TenantContext, table: string, prefix: string): Promise<string> {
    const schema = this.tenant.quote(ctx.schemaName);
    const rows = await this.db.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*)::bigint AS count FROM ${schema}.${table}`,
    );
    return `${prefix}-${String(Number(rows[0].count) + 1).padStart(5, '0')}`;
  }

  private async updateInvoiceStatus(ctx: TenantContext, invoiceId: string) {
    const schema = this.tenant.quote(ctx.schemaName);
    const rows = await this.db.$queryRawUnsafe<TotalRow[]>(
      `SELECT i.total - COALESCE(SUM(cp.amount), 0) AS total
       FROM ${schema}.invoices i
       LEFT JOIN ${schema}.customer_payments cp ON cp.invoice_id = i.id
       WHERE i.id = $1::uuid GROUP BY i.id`, invoiceId,
    );
    const remaining = Number(rows[0]?.total ?? 0);
    await this.db.$executeRawUnsafe(
      `UPDATE ${schema}.invoices SET status = $1 WHERE id = $2::uuid`,
      remaining <= 0 ? 'paid' : 'partial', invoiceId,
    );
  }

  private async updateBillStatus(ctx: TenantContext, billId: string) {
    const schema = this.tenant.quote(ctx.schemaName);
    const rows = await this.db.$queryRawUnsafe<TotalRow[]>(
      `SELECT b.total - COALESCE(SUM(vp.amount), 0) AS total
       FROM ${schema}.vendor_bills b
       LEFT JOIN ${schema}.vendor_payments vp ON vp.vendor_bill_id = b.id
       WHERE b.id = $1::uuid GROUP BY b.id`, billId,
    );
    const remaining = Number(rows[0]?.total ?? 0);
    await this.db.$executeRawUnsafe(
      `UPDATE ${schema}.vendor_bills SET status = $1 WHERE id = $2::uuid`,
      remaining <= 0 ? 'paid' : 'partial', billId,
    );
  }
}

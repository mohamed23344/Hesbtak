import {
  Body, Controller, Delete, Get, Headers, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { TenantService } from '../tenant/tenant.service';
import { AccountingService } from './accounting.service';
import {
  AccountDto, AttachInvoiceDto, InvoiceDto, JournalEntryDto,
  PartyDto, PaymentDto, ReturnDto, VendorBillDto, VoucherDto,
} from './dto';

@UseGuards(JwtAuthGuard)
@Controller('tenant')
export class AccountingController {
  constructor(
    private readonly accounting: AccountingService,
    private readonly tenant: TenantService,
  ) {}

  // ─── Accounts ───────────────────────────────────────────────────

  @Get('accounts')
  async accounts(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listAccounts(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'accounts'));
  }

  @Post('accounts')
  async upsertAccount(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Body() dto: AccountDto) {
    return this.accounting.upsertAccount(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), dto);
  }

  @Delete('accounts/:id')
  async deleteAccount(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.accounting.deleteAccount(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), id);
  }

  // ─── Customers ──────────────────────────────────────────────────

  @Get('customers')
  async customers(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listCustomers(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'accounting'));
  }

  @Post('customers')
  async createCustomer(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Body() dto: PartyDto) {
    return this.accounting.createCustomer(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), user.sub, dto);
  }

  // ─── Vendors ────────────────────────────────────────────────────

  @Get('vendors')
  async vendors(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listVendors(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'accounting'));
  }

  @Post('vendors')
  async createVendor(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Body() dto: PartyDto) {
    return this.accounting.createVendor(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), user.sub, dto);
  }

  // ─── Journal Entries ────────────────────────────────────────────

  @Get('journal-entries')
  async journalEntries(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listJournalEntries(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'journal'));
  }

  @Post('journal-entries')
  async createJournalEntry(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Body() dto: JournalEntryDto) {
    return this.accounting.createJournalEntry(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), user.sub, dto);
  }

  @Delete('journal-entries/:id')
  async deleteJournalEntry(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.accounting.deleteJournalEntry(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), id);
  }

  @Post('journal-entries/:id/attach-invoice')
  async attachInvoice(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Param('id') journalEntryId: string, @Body() dto: AttachInvoiceDto) {
    return this.accounting.attachInvoiceToJournalEntry(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), user.sub, journalEntryId, dto);
  }

  // ─── Vouchers (Expense / Receipt) ──────────────────────────────

  @Post('vouchers')
  async createVoucher(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Body() dto: VoucherDto) {
    return this.accounting.createVoucher(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), user.sub, dto);
  }

  // ─── Invoices ──────────────────────────────────────────────────

  @Get('invoices')
  async invoices(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listInvoices(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'invoices'));
  }

  @Get('invoices/unpaid')
  async unpaidInvoices(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listUnpaidInvoices(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'invoices'));
  }

  @Get('invoices/:id')
  async invoice(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.accounting.getInvoice(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'invoices'), id);
  }

  @Post('invoices')
  async createInvoice(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Body() dto: InvoiceDto) {
    return this.accounting.createInvoice(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), user.sub, dto);
  }

  @Patch('invoices/:id')
  async updateInvoice(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: InvoiceDto) {
    return this.accounting.updateInvoice(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), user.sub, id, dto);
  }

  @Delete('invoices/:id')
  async deleteInvoice(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.accounting.deleteInvoice(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), id);
  }

  // ─── Customer Payments ─────────────────────────────────────────

  @Get('customer-payments')
  async customerPayments(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listCustomerPayments(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'invoices'));
  }

  @Post('customer-payments')
  async createCustomerPayment(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Body() dto: PaymentDto) {
    return this.accounting.createCustomerPayment(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), user.sub, dto);
  }

  // ─── Vendor Bills ──────────────────────────────────────────────

  @Get('vendor-bills')
  async vendorBills(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listVendorBills(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'accounting'));
  }

  @Get('vendor-bills/unpaid')
  async unpaidBills(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listUnpaidBills(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'accounting'));
  }

  @Get('vendor-bills/:id')
  async vendorBill(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.accounting.getVendorBill(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'accounting'), id);
  }

  @Post('vendor-bills')
  async createVendorBill(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Body() dto: VendorBillDto) {
    return this.accounting.createVendorBill(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), user.sub, dto);
  }

  @Patch('vendor-bills/:id')
  async updateVendorBill(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Param('id') id: string, @Body() dto: VendorBillDto) {
    return this.accounting.updateVendorBill(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), user.sub, id, dto);
  }

  @Delete('vendor-bills/:id')
  async deleteVendorBill(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.accounting.deleteVendorBill(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), id);
  }

  // ─── Vendor Payments ───────────────────────────────────────────

  @Get('vendor-payments')
  async vendorPayments(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listVendorPayments(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'accounting'));
  }

  @Post('vendor-payments')
  async createVendorPayment(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Body() dto: PaymentDto) {
    return this.accounting.createVendorPayment(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), user.sub, dto);
  }

  // ─── Returns ───────────────────────────────────────────────────

  // Sales Returns
  @Get('sales-returns')
  async salesReturns(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listSalesReturns(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'invoices'));
  }

  @Post('sales-returns')
  async createSalesReturn(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Body() dto: ReturnDto) {
    return this.accounting.createSalesReturn(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), user.sub, dto);
  }

  // Purchase Returns
  @Get('purchase-returns')
  async purchaseReturns(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listPurchaseReturns(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'accounting'));
  }

  @Post('purchase-returns')
  async createPurchaseReturn(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser, @Body() dto: ReturnDto) {
    return this.accounting.createPurchaseReturn(await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']), user.sub, dto);
  }
}

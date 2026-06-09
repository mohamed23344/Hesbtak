import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, JwtUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { TenantService } from '../tenant/tenant.service';
import { AccountingService } from './accounting.service';
import {
  AccountDto,
  AttachInvoiceDto,
  InvoiceDto,
  JournalEntryDto,
  PartyDto,
  PaymentDto,
  VendorBillDto,
} from './dto';

@UseGuards(JwtAuthGuard)
@Controller('tenant')
export class AccountingController {
  constructor(
    private readonly accounting: AccountingService,
    private readonly tenant: TenantService,
  ) {}

  @Get('accounts')
  async accounts(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listAccounts(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'accounts'));
  }

  @Post('accounts')
  async upsertAccount(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: AccountDto,
  ) {
    return this.accounting.upsertAccount(
      await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']),
      dto,
    );
  }

  @Delete('accounts/:id')
  async deleteAccount(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.accounting.deleteAccount(
      await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']),
      id,
    );
  }

  @Get('customers')
  async customers(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listCustomers(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'accounting'));
  }

  @Post('customers')
  async createCustomer(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: PartyDto,
  ) {
    return this.accounting.createCustomer(
      await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']),
      user.sub,
      dto,
    );
  }

  @Get('vendors')
  async vendors(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listVendors(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'accounting'));
  }

  @Post('vendors')
  async createVendor(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: PartyDto,
  ) {
    return this.accounting.createVendor(
      await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']),
      user.sub,
      dto,
    );
  }

  @Get('journal-entries')
  async journalEntries(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listJournalEntries(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'journal'));
  }

  @Post('journal-entries')
  async createJournalEntry(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: JournalEntryDto,
  ) {
    return this.accounting.createJournalEntry(
      await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']),
      user.sub,
      dto,
    );
  }

  @Delete('journal-entries/:id')
  async deleteJournalEntry(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.accounting.deleteJournalEntry(
      await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']),
      id,
    );
  }

  @Post('journal-entries/:id/attach-invoice')
  async attachInvoice(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Param('id') journalEntryId: string,
    @Body() dto: AttachInvoiceDto,
  ) {
    return this.accounting.attachInvoiceToJournalEntry(
      await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']),
      user.sub,
      journalEntryId,
      dto,
    );
  }

  @Get('invoices')
  async invoices(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listInvoices(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'invoices'));
  }

  @Post('invoices')
  async createInvoice(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: InvoiceDto,
  ) {
    return this.accounting.createInvoice(
      await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']),
      user.sub,
      dto,
    );
  }

  @Post('customer-payments')
  async createCustomerPayment(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: PaymentDto,
  ) {
    return this.accounting.createCustomerPayment(
      await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']),
      user.sub,
      dto,
    );
  }

  @Get('vendor-bills')
  async vendorBills(@Headers('x-tenant-id') orgId: string, @CurrentUser() user: JwtUser) {
    return this.accounting.listVendorBills(await this.tenant.fromOrganizationId(orgId, user.sub, undefined, 'accounting'));
  }

  @Post('vendor-bills')
  async createVendorBill(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: VendorBillDto,
  ) {
    return this.accounting.createVendorBill(
      await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']),
      user.sub,
      dto,
    );
  }

  @Post('vendor-payments')
  async createVendorPayment(
    @Headers('x-tenant-id') orgId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: PaymentDto,
  ) {
    return this.accounting.createVendorPayment(
      await this.tenant.fromOrganizationId(orgId, user.sub, ['owner', 'accountant']),
      user.sub,
      dto,
    );
  }
}

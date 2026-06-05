import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataBaseService } from '../../database/database.service';

export interface TenantContext {
  organizationId: string;
  schemaName: string;
  role: string;
}

@Injectable()
export class TenantService {
  constructor(private readonly db: DataBaseService) {}

  schemaNameForOrganization(id: string): string {
    return `tenant_${id.replaceAll('-', '_')}`;
  }

  quote(schemaName: string): string {
    if (!/^tenant_[a-f0-9_]+$/.test(schemaName)) {
      throw new Error('Unsafe tenant schema name');
    }
    return `"${schemaName}"`;
  }

  async fromOrganizationId(
    organizationId: string,
    userId: string,
    allowedRoles: string[] = ['owner', 'accountant', 'viewer'],
  ): Promise<TenantContext> {
    const membership = await this.db.organizationUser.findFirst({
      where: { organizationId, userId, isActive: true },
      include: { organization: true },
    });

    if (!membership) {
      throw new NotFoundException('Tenant context not found for user');
    }

    if (!allowedRoles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient tenant role');
    }

    return {
      organizationId,
      schemaName: membership.organization.schemaName,
      role: membership.role,
    };
  }

  async provisionTenantSchema(schemaName: string): Promise<void> {
    const schema = this.quote(schemaName);
    await this.db.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS ${schema};`);
    await this.db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ${schema}.accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        parent_id UUID REFERENCES ${schema}.accounts(id),
        code VARCHAR NOT NULL UNIQUE,
        name VARCHAR NOT NULL,
        type VARCHAR NOT NULL,
        is_leaf BOOLEAN NOT NULL DEFAULT true,
        level INT NOT NULL DEFAULT 1,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.onboarding_responses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        question_key VARCHAR NOT NULL,
        answer TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.customers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        email VARCHAR,
        phone VARCHAR,
        address TEXT,
        payment_terms INT,
        currency VARCHAR,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_by UUID NOT NULL REFERENCES public.users(id)
      );
      CREATE TABLE IF NOT EXISTS ${schema}.vendors (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        email VARCHAR,
        phone VARCHAR,
        address TEXT,
        payment_terms INT,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_by UUID NOT NULL REFERENCES public.users(id)
      );
      CREATE TABLE IF NOT EXISTS ${schema}.bank_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        account_number VARCHAR,
        bank_name VARCHAR,
        currency VARCHAR NOT NULL,
        gl_account_id UUID NOT NULL REFERENCES ${schema}.accounts(id),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.journal_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        date DATE NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'posted',
        reference_type VARCHAR,
        reference_id UUID,
        created_by UUID NOT NULL REFERENCES public.users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.journal_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        journal_entry_id UUID NOT NULL REFERENCES ${schema}.journal_entries(id) ON DELETE CASCADE,
        account_id UUID NOT NULL REFERENCES ${schema}.accounts(id),
        debit DECIMAL(15,2) NOT NULL DEFAULT 0,
        credit DECIMAL(15,2) NOT NULL DEFAULT 0,
        description TEXT
      );
      CREATE TABLE IF NOT EXISTS ${schema}.invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_number VARCHAR NOT NULL UNIQUE,
        customer_id UUID NOT NULL REFERENCES ${schema}.customers(id),
        issue_date DATE NOT NULL,
        due_date DATE NOT NULL,
        subtotal DECIMAL(15,2) NOT NULL,
        tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        total DECIMAL(15,2) NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'unpaid',
        journal_entry_id UUID REFERENCES ${schema}.journal_entries(id),
        created_by UUID NOT NULL REFERENCES public.users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.invoice_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invoice_id UUID NOT NULL REFERENCES ${schema}.invoices(id) ON DELETE CASCADE,
        line_number INT NOT NULL,
        description TEXT NOT NULL,
        quantity DECIMAL(15,4) NOT NULL DEFAULT 1,
        unit_price DECIMAL(15,2) NOT NULL,
        discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
        line_subtotal DECIMAL(15,2) NOT NULL,
        tax_amount DECIMAL(15,2) NOT NULL,
        line_total DECIMAL(15,2) NOT NULL,
        revenue_account_id UUID REFERENCES ${schema}.accounts(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.customer_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL REFERENCES ${schema}.customers(id),
        invoice_id UUID REFERENCES ${schema}.invoices(id),
        amount DECIMAL(15,2) NOT NULL,
        payment_method VARCHAR NOT NULL,
        bank_account_id UUID REFERENCES ${schema}.bank_accounts(id),
        payment_date DATE NOT NULL,
        reference VARCHAR,
        journal_entry_id UUID REFERENCES ${schema}.journal_entries(id),
        notes TEXT,
        created_by UUID NOT NULL REFERENCES public.users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.vendor_bills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bill_number VARCHAR NOT NULL UNIQUE,
        vendor_id UUID NOT NULL REFERENCES ${schema}.vendors(id),
        issue_date DATE NOT NULL,
        due_date DATE NOT NULL,
        subtotal DECIMAL(15,2) NOT NULL,
        tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        total DECIMAL(15,2) NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'received',
        journal_entry_id UUID REFERENCES ${schema}.journal_entries(id),
        created_by UUID NOT NULL REFERENCES public.users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.vendor_bill_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_bill_id UUID NOT NULL REFERENCES ${schema}.vendor_bills(id) ON DELETE CASCADE,
        line_number INT NOT NULL,
        description TEXT NOT NULL,
        quantity DECIMAL(15,4) NOT NULL DEFAULT 1,
        unit_cost DECIMAL(15,2) NOT NULL,
        discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
        line_subtotal DECIMAL(15,2) NOT NULL,
        tax_amount DECIMAL(15,2) NOT NULL,
        line_total DECIMAL(15,2) NOT NULL,
        expense_account_id UUID REFERENCES ${schema}.accounts(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.vendor_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        vendor_bill_id UUID NOT NULL REFERENCES ${schema}.vendor_bills(id),
        vendor_id UUID NOT NULL REFERENCES ${schema}.vendors(id),
        amount DECIMAL(15,2) NOT NULL,
        payment_method VARCHAR NOT NULL,
        bank_account_id UUID REFERENCES ${schema}.bank_accounts(id),
        payment_date DATE NOT NULL,
        reference VARCHAR,
        journal_entry_id UUID REFERENCES ${schema}.journal_entries(id),
        notes TEXT,
        created_by UUID NOT NULL REFERENCES public.users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.expenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        expense_number VARCHAR NOT NULL UNIQUE,
        expense_date DATE NOT NULL,
        category VARCHAR,
        description TEXT NOT NULL,
        vendor_id UUID REFERENCES ${schema}.vendors(id),
        amount DECIMAL(15,2) NOT NULL,
        tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        total DECIMAL(15,2) NOT NULL,
        expense_account_id UUID NOT NULL REFERENCES ${schema}.accounts(id),
        payment_method VARCHAR NOT NULL,
        bank_account_id UUID REFERENCES ${schema}.bank_accounts(id),
        journal_entry_id UUID REFERENCES ${schema}.journal_entries(id),
        attachment_url VARCHAR,
        created_by UUID NOT NULL REFERENCES public.users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.recurring_entries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        frequency VARCHAR NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        next_run DATE NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        template JSONB NOT NULL,
        created_by UUID NOT NULL REFERENCES public.users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.recurring_entry_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recurring_entry_id UUID NOT NULL REFERENCES ${schema}.recurring_entries(id),
        journal_entry_id UUID REFERENCES ${schema}.journal_entries(id),
        generated_date DATE NOT NULL,
        status VARCHAR NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.ocr_uploads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_url VARCHAR NOT NULL,
        extracted_text TEXT,
        confidence_score DECIMAL(5,2),
        status VARCHAR NOT NULL,
        result_type VARCHAR,
        result_id UUID,
        created_by UUID NOT NULL REFERENCES public.users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.ai_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL,
        user_id UUID NOT NULL REFERENCES public.users(id),
        parent_id UUID REFERENCES ${schema}.ai_conversations(id),
        question TEXT NOT NULL,
        response TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.forecasts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        forecast_month DATE NOT NULL,
        predicted_revenue DECIMAL(15,2) NOT NULL,
        predicted_expense DECIMAL(15,2) NOT NULL,
        predicted_cashflow DECIMAL(15,2) NOT NULL,
        model_version VARCHAR NOT NULL,
        confidence_low DECIMAL(15,2),
        confidence_high DECIMAL(15,2),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR NOT NULL,
        severity VARCHAR NOT NULL,
        title VARCHAR NOT NULL,
        message TEXT NOT NULL,
        entity_type VARCHAR,
        entity_id UUID,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.alert_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        rule_type VARCHAR NOT NULL,
        parameters JSONB NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.suggestions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR NOT NULL,
        title VARCHAR NOT NULL,
        description TEXT NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  async seedChartOfAccounts(
    schemaName: string,
    industry: string,
  ): Promise<void> {
    const schema = this.quote(schemaName);
    const baseAccounts = [
      ['1000', 'Cash and Bank', 'Asset'],
      ['1100', 'Accounts Receivable', 'Asset'],
      ['2000', 'Accounts Payable', 'Liability'],
      ['3000', 'Owner Equity', 'Equity'],
      ['4000', 'Sales Revenue', 'Revenue'],
      ['5000', 'Operating Expenses', 'Expense'],
      ['5100', industry.toLowerCase().includes('software') ? 'Cloud Services' : 'Office Supplies', 'Expense'],
    ];

    for (const account of baseAccounts) {
      await this.db.$executeRawUnsafe(
        `INSERT INTO ${schema}.accounts (code, name, type)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO NOTHING`,
        account[0],
        account[1],
        account[2],
      );
    }
  }
}

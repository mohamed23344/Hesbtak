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
  permissions?: string[];
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
    requiredPermission?: string,
    requiredFeature?: 'chatbot' | 'invoiceAiExtraction',
  ): Promise<TenantContext> {
    await this.ensureAccessControlSchema();
    const membership = await this.db.organizationUser.findFirst({
      where: { organizationId, userId, isActive: true },
      include: { organization: true },
    });

    if (!membership) {
      throw new NotFoundException('Tenant context not found for user');
    }

    if (!membership.organization.isActive) {
      throw new ForbiddenException('Tenant is deactivated');
    }

    if (!allowedRoles.includes(membership.role)) {
      throw new ForbiddenException('Insufficient tenant role');
    }
    if (membership.accessExpiresAt && membership.accessExpiresAt <= new Date()) {
      throw new ForbiddenException('Organization access has expired');
    }
    const permissions = Array.isArray(membership.permissions)
      ? membership.permissions.filter((value): value is string => typeof value === 'string')
      : [];
    if (
      membership.role === 'viewer' &&
      requiredPermission &&
      !permissions.includes(requiredPermission)
    ) {
      throw new ForbiddenException('This dashboard is not included in your viewer access');
    }
    if (requiredFeature) {
      const subscription = await this.subscriptionForOrganization(organizationId);
      const features = this.featureMap(subscription?.plan.features);
      if (!features[requiredFeature]) {
        throw new ForbiddenException(
          requiredFeature === 'chatbot'
            ? 'The AI chatbot requires the AI Pro subscription'
            : 'AI invoice extraction requires the AI Pro subscription',
        );
      }
    }

    return {
      organizationId,
      schemaName: membership.organization.schemaName,
      role: membership.role,
      permissions,
    };
  }

  async subscriptionForOrganization(organizationId: string) {
    return this.db.subscription.findFirst({
      where: {
        organizationId,
        status: 'active',
        currentPeriodEnd: { gt: new Date() },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  featureMap(value: unknown): Record<string, boolean> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).map(([key, enabled]) => [key, enabled === true]),
    );
  }

  async ensureAccessControlSchema() {
    await this.db.$executeRawUnsafe(`
      ALTER TABLE public.organization_users
        ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS permissions JSONB;
      ALTER TABLE public.invitations
        ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS permissions JSONB;
    `);
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
        account_id UUID REFERENCES ${schema}.accounts(id),
        related_account_id UUID REFERENCES ${schema}.accounts(id),
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
        vendor_id UUID REFERENCES ${schema}.vendors(id),
        type VARCHAR NOT NULL DEFAULT 'purchase' CHECK (type IN ('purchase', 'expense')),
        issue_date DATE NOT NULL,
        due_date DATE NOT NULL,
        subtotal DECIMAL(15,2) NOT NULL,
        tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        total DECIMAL(15,2) NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'received',
        account_id UUID REFERENCES ${schema}.accounts(id),
        related_account_id UUID REFERENCES ${schema}.accounts(id),
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
      CREATE TABLE IF NOT EXISTS ${schema}.sales_returns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        return_number VARCHAR NOT NULL UNIQUE,
        invoice_id UUID REFERENCES ${schema}.invoices(id),
        customer_id UUID NOT NULL REFERENCES ${schema}.customers(id),
        return_date DATE NOT NULL,
        reason TEXT NOT NULL,
        subtotal DECIMAL(15,2) NOT NULL,
        tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        total DECIMAL(15,2) NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'processed',
        journal_entry_id UUID REFERENCES ${schema}.journal_entries(id),
        created_by UUID NOT NULL REFERENCES public.users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.sales_return_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sales_return_id UUID NOT NULL REFERENCES ${schema}.sales_returns(id) ON DELETE CASCADE,
        line_number INT NOT NULL,
        description TEXT NOT NULL,
        quantity DECIMAL(15,4) NOT NULL DEFAULT 1,
        unit_price DECIMAL(15,2) NOT NULL,
        tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
        line_subtotal DECIMAL(15,2) NOT NULL,
        tax_amount DECIMAL(15,2) NOT NULL,
        line_total DECIMAL(15,2) NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${schema}.purchase_returns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        return_number VARCHAR NOT NULL UNIQUE,
        bill_id UUID REFERENCES ${schema}.vendor_bills(id),
        vendor_id UUID NOT NULL REFERENCES ${schema}.vendors(id),
        return_date DATE NOT NULL,
        reason TEXT NOT NULL,
        subtotal DECIMAL(15,2) NOT NULL,
        tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
        total DECIMAL(15,2) NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'processed',
        journal_entry_id UUID REFERENCES ${schema}.journal_entries(id),
        created_by UUID NOT NULL REFERENCES public.users(id),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS ${schema}.purchase_return_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        purchase_return_id UUID NOT NULL REFERENCES ${schema}.purchase_returns(id) ON DELETE CASCADE,
        line_number INT NOT NULL,
        description TEXT NOT NULL,
        quantity DECIMAL(15,4) NOT NULL DEFAULT 1,
        unit_price DECIMAL(15,2) NOT NULL,
        tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
        line_subtotal DECIMAL(15,2) NOT NULL,
        tax_amount DECIMAL(15,2) NOT NULL,
        line_total DECIMAL(15,2) NOT NULL
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
      CREATE TABLE IF NOT EXISTS ${schema}.report_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        description TEXT,
        configuration_json JSONB NOT NULL,
        created_by UUID REFERENCES public.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS ${schema}.reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR NOT NULL,
        report_type VARCHAR NOT NULL,
        configuration_json JSONB NOT NULL,
        created_by UUID NOT NULL REFERENCES public.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS ${schema}.scheduled_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID NOT NULL REFERENCES ${schema}.reports(id) ON DELETE CASCADE,
        frequency VARCHAR NOT NULL,
        timezone VARCHAR NOT NULL DEFAULT 'UTC',
        start_date DATE NOT NULL,
        end_date DATE,
        time_of_day TIME NOT NULL DEFAULT '09:00',
        next_run_at TIMESTAMPTZ NOT NULL,
        last_run_at TIMESTAMPTZ,
        status VARCHAR NOT NULL DEFAULT 'active',
        recipients_json JSONB NOT NULL DEFAULT '[]',
        delivery_methods JSONB NOT NULL DEFAULT '["in_app"]',
        export_format VARCHAR NOT NULL DEFAULT 'pdf',
        created_by UUID NOT NULL REFERENCES public.users(id),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS ${schema}.report_executions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        report_id UUID REFERENCES ${schema}.reports(id) ON DELETE SET NULL,
        scheduled_report_id UUID REFERENCES ${schema}.scheduled_reports(id) ON DELETE SET NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed_at TIMESTAMPTZ,
        status VARCHAR NOT NULL,
        file_url TEXT,
        file_name TEXT,
        content_type TEXT,
        file_data BYTEA,
        export_format VARCHAR,
        result_json JSONB,
        email_status VARCHAR,
        emailed_at TIMESTAMPTZ,
        error_message TEXT
      );
      ALTER TABLE ${schema}.invoices
        ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES ${schema}.accounts(id),
        ADD COLUMN IF NOT EXISTS related_account_id UUID REFERENCES ${schema}.accounts(id);
      ALTER TABLE ${schema}.vendor_bills
        ADD COLUMN IF NOT EXISTS type VARCHAR NOT NULL DEFAULT 'purchase',
        ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES ${schema}.accounts(id),
        ADD COLUMN IF NOT EXISTS related_account_id UUID REFERENCES ${schema}.accounts(id);
      ALTER TABLE ${schema}.vendor_bills ALTER COLUMN vendor_id DROP NOT NULL;
      UPDATE ${schema}.invoices i
         SET account_id = source.account_id
        FROM (
          SELECT invoice_id, MIN(revenue_account_id::text)::uuid AS account_id
            FROM ${schema}.invoice_lines
           WHERE revenue_account_id IS NOT NULL
           GROUP BY invoice_id
        ) source
       WHERE i.id = source.invoice_id AND i.account_id IS NULL;
      UPDATE ${schema}.vendor_bills b
         SET account_id = source.account_id
        FROM (
          SELECT vendor_bill_id, MIN(expense_account_id::text)::uuid AS account_id
            FROM ${schema}.vendor_bill_lines
           WHERE expense_account_id IS NOT NULL
           GROUP BY vendor_bill_id
        ) source
       WHERE b.id = source.vendor_bill_id AND b.account_id IS NULL;
    `);
  }

  async seedChartOfAccounts(
    schemaName: string,
    industry: string,
  ): Promise<void> {
    const schema = this.quote(schemaName);
    const hierarchy = [
      ['1000', 'Assets', 'Asset', null, 1, false],
      ['1100', 'Current Assets', 'Asset', '1000', 2, false],
      ['1110', 'Trade Receivables', 'Asset', '1100', 3, true],
      ['1120', 'Accrued Revenues', 'Asset', '1100', 3, true],
      ['1130', 'Cash on Hand', 'Asset', '1100', 3, true],
      ['1140', 'Bank Accounts', 'Asset', '1100', 3, true],
      ['1150', 'Payment Processors', 'Asset', '1100', 3, true],
      ['1160', 'Prepaid Expenses', 'Asset', '1100', 3, true],
      ['1170', 'Recoverable VAT', 'Asset', '1100', 3, true],
      ['1180', 'Withholding Tax Receivable', 'Asset', '1100', 3, true],
      ['1190', 'Deposits with Others', 'Asset', '1100', 3, true],
      ['1200', 'Fixed Assets', 'Asset', '1000', 2, false],
      ['1210', 'Furniture and Fixtures', 'Asset', '1200', 3, true],
      ['1220', 'Machinery and Equipment', 'Asset', '1200', 3, true],
      ['1230', 'Software and Systems', 'Asset', '1200', 3, true],
      ['1240', 'Vehicles and Transportation', 'Asset', '1200', 3, true],
      ['1250', 'Computers and Accessories', 'Asset', '1200', 3, true],
      ['1260', 'Accumulated Depreciation', 'Asset', '1200', 3, true],
      ['1300', 'Inventory', 'Asset', '1000', 2, false],
      ['2000', 'Liabilities', 'Liability', null, 1, false],
      ['2100', 'Current Liabilities', 'Liability', '2000', 2, false],
      ['2110', 'Suppliers and Accounts Payable', 'Liability', '2100', 3, true],
      ['2120', 'Output Tax Payable', 'Liability', '2100', 3, true],
      ['3000', 'Equity', 'Equity', null, 1, false],
      ['3100', 'Owner Equity', 'Equity', '3000', 2, true],
      ['4000', 'Revenue', 'Revenue', null, 1, false],
      ['4100', 'Sales Revenue', 'Revenue', '4000', 2, true],
      ['5000', 'Expenses', 'Expense', null, 1, false],
      ['5200', 'Operating Expenses', 'Expense', '5000', 2, false],
    ] as const;

    for (const [code, name, type, parentCode, level, isLeaf] of hierarchy) {
      await this.db.$executeRawUnsafe(
        `INSERT INTO ${schema}.accounts (code, name, type, parent_id, level, is_leaf)
         VALUES ($1, $2, $3, (SELECT id FROM ${schema}.accounts WHERE code = $4), $5, $6)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name,
           type = EXCLUDED.type,
           parent_id = EXCLUDED.parent_id,
           level = EXCLUDED.level,
           is_leaf = EXCLUDED.is_leaf`,
        code, name, type, parentCode, level, isLeaf,
      );
    }

    const baseAccounts = [
      ['5210', industry.toLowerCase().includes('software') ? 'Cloud Services' : 'Office Supplies', 'Expense', '5200', 3, true],
    ];

    for (const [code, name, type, parentCode, level, isLeaf] of baseAccounts) {
      await this.db.$executeRawUnsafe(
        `INSERT INTO ${schema}.accounts (code, name, type, parent_id, level, is_leaf)
         VALUES ($1, $2, $3, (SELECT id FROM ${schema}.accounts WHERE code = $4), $5, $6)
         ON CONFLICT (code) DO NOTHING`,
        code,
        name,
        type,
        parentCode,
        level,
        isLeaf,
      );
    }
  }
}

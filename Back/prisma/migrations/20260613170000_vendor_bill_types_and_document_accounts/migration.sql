DO $$
DECLARE
  tenant_schema text;
BEGIN
  FOR tenant_schema IN
    SELECT schema_name
      FROM public.organizations
     WHERE schema_name ~ '^tenant_[a-f0-9_]+$'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.invoices ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES %I.accounts(id)',
      tenant_schema,
      tenant_schema
    );
    EXECUTE format(
      'ALTER TABLE %I.vendor_bills
         ADD COLUMN IF NOT EXISTS type VARCHAR NOT NULL DEFAULT ''purchase'',
         ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES %I.accounts(id)',
      tenant_schema,
      tenant_schema
    );
    EXECUTE format(
      'ALTER TABLE %I.vendor_bills ALTER COLUMN vendor_id DROP NOT NULL',
      tenant_schema
    );
    EXECUTE format(
      'UPDATE %I.invoices i
          SET account_id = source.account_id
         FROM (
           SELECT invoice_id, MIN(revenue_account_id::text)::uuid AS account_id
             FROM %I.invoice_lines
            WHERE revenue_account_id IS NOT NULL
            GROUP BY invoice_id
         ) source
        WHERE i.id = source.invoice_id AND i.account_id IS NULL',
      tenant_schema,
      tenant_schema
    );
    EXECUTE format(
      'UPDATE %I.vendor_bills b
          SET account_id = source.account_id
         FROM (
           SELECT vendor_bill_id, MIN(expense_account_id::text)::uuid AS account_id
             FROM %I.vendor_bill_lines
            WHERE expense_account_id IS NOT NULL
            GROUP BY vendor_bill_id
         ) source
        WHERE b.id = source.vendor_bill_id AND b.account_id IS NULL',
      tenant_schema,
      tenant_schema
    );
    EXECUTE format(
      'ALTER TABLE %I.vendor_bills
         DROP CONSTRAINT IF EXISTS vendor_bills_type_check',
      tenant_schema
    );
    EXECUTE format(
      'ALTER TABLE %I.vendor_bills
         ADD CONSTRAINT vendor_bills_type_check CHECK (type IN (''purchase'', ''expense''))',
      tenant_schema
    );
  END LOOP;
END $$;

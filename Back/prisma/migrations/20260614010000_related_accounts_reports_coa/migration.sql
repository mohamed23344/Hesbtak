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
      'ALTER TABLE %I.invoices
         ADD COLUMN IF NOT EXISTS related_account_id UUID REFERENCES %I.accounts(id)',
      tenant_schema, tenant_schema
    );
    EXECUTE format(
      'ALTER TABLE %I.vendor_bills
         ADD COLUMN IF NOT EXISTS related_account_id UUID REFERENCES %I.accounts(id)',
      tenant_schema, tenant_schema
    );

    EXECUTE format(
      'INSERT INTO %I.accounts (code, name, type, level, is_leaf)
       VALUES (''1000'', ''Assets'', ''Asset'', 1, false)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type,
         parent_id = NULL, level = 1, is_leaf = false',
      tenant_schema
    );
    EXECUTE format(
      'INSERT INTO %I.accounts (code, name, type, parent_id, level, is_leaf)
       VALUES
         (''1100'', ''Current Assets'', ''Asset'', (SELECT id FROM %I.accounts WHERE code = ''1000''), 2, false),
         (''1200'', ''Fixed Assets'', ''Asset'', (SELECT id FROM %I.accounts WHERE code = ''1000''), 2, false)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type,
         parent_id = EXCLUDED.parent_id, level = EXCLUDED.level, is_leaf = EXCLUDED.is_leaf',
      tenant_schema, tenant_schema, tenant_schema
    );
    EXECUTE format(
      'INSERT INTO %I.accounts (code, name, type, parent_id, level, is_leaf)
       VALUES
         (''1110'', ''Trade Receivables'', ''Asset'', (SELECT id FROM %I.accounts WHERE code = ''1100''), 3, true),
         (''1130'', ''Cash on Hand'', ''Asset'', (SELECT id FROM %I.accounts WHERE code = ''1100''), 3, true),
         (''1140'', ''Bank Accounts'', ''Asset'', (SELECT id FROM %I.accounts WHERE code = ''1100''), 3, true),
         (''1150'', ''Payment Processors'', ''Asset'', (SELECT id FROM %I.accounts WHERE code = ''1100''), 3, true),
         (''1170'', ''Recoverable VAT'', ''Asset'', (SELECT id FROM %I.accounts WHERE code = ''1100''), 3, true),
         (''1210'', ''Furniture and Fixtures'', ''Asset'', (SELECT id FROM %I.accounts WHERE code = ''1200''), 3, true)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type,
         parent_id = EXCLUDED.parent_id, level = EXCLUDED.level, is_leaf = EXCLUDED.is_leaf',
      tenant_schema, tenant_schema, tenant_schema, tenant_schema, tenant_schema, tenant_schema, tenant_schema
    );

    EXECUTE format(
      'UPDATE %I.invoices
          SET related_account_id = (SELECT id FROM %I.accounts WHERE code = ''1110'')
        WHERE related_account_id IS NULL',
      tenant_schema, tenant_schema
    );
    EXECUTE format(
      'UPDATE %I.vendor_bills
          SET related_account_id = (SELECT id FROM %I.accounts WHERE code = ''2000'')
        WHERE related_account_id IS NULL',
      tenant_schema, tenant_schema
    );

    IF to_regclass(format('%I.reports', tenant_schema)) IS NOT NULL THEN
      IF to_regclass(format('%I.scheduled_reports', tenant_schema)) IS NOT NULL THEN
        EXECUTE format(
          'DELETE FROM %I.scheduled_reports
            WHERE report_id IN (SELECT id FROM %I.reports WHERE report_type = ''budget_vs_actual'')',
          tenant_schema, tenant_schema
        );
      END IF;
      EXECUTE format(
        'DELETE FROM %I.reports WHERE report_type = ''budget_vs_actual''',
        tenant_schema
      );
    END IF;
  END LOOP;
END $$;

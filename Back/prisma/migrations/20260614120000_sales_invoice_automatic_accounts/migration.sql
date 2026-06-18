DO $$
DECLARE
  tenant_schema RECORD;
BEGIN
  FOR tenant_schema IN
    SELECT schema_name
      FROM information_schema.schemata
     WHERE schema_name LIKE 'tenant\_%' ESCAPE '\'
  LOOP
    EXECUTE format(
      'INSERT INTO %I.accounts (code, name, type, parent_id, level, is_leaf)
       VALUES
         (''1110'', ''Trade Receivables'', ''Asset'', (SELECT id FROM %I.accounts WHERE code = ''110''), 3, true),
         (''1210'', ''Cash on Hand'', ''Asset'', (SELECT id FROM %I.accounts WHERE code = ''110''), 3, true),
         (''1220'', ''Bank Accounts'', ''Asset'', (SELECT id FROM %I.accounts WHERE code = ''110''), 3, true),
         (''1230'', ''Payment Processors'', ''Asset'', (SELECT id FROM %I.accounts WHERE code = ''110''), 3, true)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         parent_id = EXCLUDED.parent_id,
         level = EXCLUDED.level,
         is_leaf = EXCLUDED.is_leaf,
         is_active = true',
      tenant_schema.schema_name,
      tenant_schema.schema_name,
      tenant_schema.schema_name,
      tenant_schema.schema_name,
      tenant_schema.schema_name
    );
  END LOOP;
END $$;

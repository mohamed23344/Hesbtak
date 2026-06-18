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
      'INSERT INTO %I.accounts (code, name, type, level, is_leaf)
       VALUES (''2110'', ''Suppliers and Accounts Payable'', ''Liability'', 1, true)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         type = EXCLUDED.type,
         level = EXCLUDED.level,
         is_leaf = EXCLUDED.is_leaf,
         is_active = true',
      tenant_schema.schema_name
    );
  END LOOP;
END $$;

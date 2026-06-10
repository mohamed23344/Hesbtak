ALTER TABLE "plans"
  ADD COLUMN IF NOT EXISTS "code" VARCHAR,
  ADD COLUMN IF NOT EXISTS "currency" VARCHAR NOT NULL DEFAULT 'EGP';

UPDATE "plans"
SET "code" = lower(regexp_replace("name", '[^a-zA-Z0-9]+', '_', 'g'))
WHERE "code" IS NULL;

ALTER TABLE "plans" ALTER COLUMN "code" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "plans_code_key" ON "plans"("code");

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "payment_reference" VARCHAR,
  ADD COLUMN IF NOT EXISTS "paymob_intention_id" VARCHAR,
  ADD COLUMN IF NOT EXISTS "paymob_transaction_id" VARCHAR;

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_payment_reference_key"
  ON "subscriptions"("payment_reference");

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "must_change_password" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "plans" ("id", "code", "name", "price", "currency", "billing_cycle", "features", "is_active")
VALUES
  (
    gen_random_uuid(),
    'core',
    'Core',
    299.00,
    'EGP',
    'monthly',
    '{"chatbot": false, "invoiceAiExtraction": false, "forecasting": true, "reports": true}'::jsonb,
    true
  ),
  (
    gen_random_uuid(),
    'ai_pro',
    'AI Pro',
    499.00,
    'EGP',
    'monthly',
    '{"chatbot": true, "invoiceAiExtraction": true, "forecasting": true, "reports": true}'::jsonb,
    true
  )
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "price" = EXCLUDED."price",
  "currency" = EXCLUDED."currency",
  "billing_cycle" = EXCLUDED."billing_cycle",
  "features" = EXCLUDED."features",
  "is_active" = true;

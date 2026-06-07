ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email_verified_at" TIMESTAMP;

ALTER TABLE "password_reset_otps"
  ADD COLUMN IF NOT EXISTS "purpose" VARCHAR NOT NULL DEFAULT 'password_reset';

DROP INDEX IF EXISTS "password_reset_otps_user_id_expires_at_idx";

CREATE INDEX IF NOT EXISTS "password_reset_otps_user_id_purpose_expires_at_idx"
  ON "password_reset_otps"("user_id", "purpose", "expires_at");

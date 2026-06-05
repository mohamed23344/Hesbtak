CREATE TABLE IF NOT EXISTS "password_reset_otps" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "code_hash" VARCHAR NOT NULL,
  "expires_at" TIMESTAMP NOT NULL,
  "used_at" TIMESTAMP,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "password_reset_otps_user_id_expires_at_idx"
  ON "password_reset_otps"("user_id", "expires_at");

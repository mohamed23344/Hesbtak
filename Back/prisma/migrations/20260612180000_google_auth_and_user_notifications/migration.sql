CREATE TABLE IF NOT EXISTS "user_notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "organization_id" UUID,
  "type" VARCHAR NOT NULL,
  "severity" VARCHAR NOT NULL DEFAULT 'info',
  "title" VARCHAR NOT NULL,
  "message" VARCHAR NOT NULL,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "user_notifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "user_notifications_user_id_created_at_idx"
  ON "user_notifications"("user_id", "created_at");

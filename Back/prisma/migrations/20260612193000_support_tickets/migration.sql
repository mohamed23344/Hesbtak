CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "organization_id" UUID,
  "subject" VARCHAR NOT NULL,
  "category" VARCHAR NOT NULL,
  "message" TEXT NOT NULL,
  "status" VARCHAR NOT NULL DEFAULT 'open',
  "admin_reply" TEXT,
  "replied_by" UUID,
  "replied_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "support_tickets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "support_tickets_user_id_created_at_idx"
  ON "support_tickets"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "support_tickets_status_created_at_idx"
  ON "support_tickets"("status", "created_at");

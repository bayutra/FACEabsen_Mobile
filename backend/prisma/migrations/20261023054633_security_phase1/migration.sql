-- AlterTable
ALTER TABLE "attendance" ADD COLUMN     "capture_at" TIMESTAMP(3),
ADD COLUMN     "offline" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stale_at" TIMESTAMP(3),
ADD COLUMN     "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "idempotency_keys" ADD COLUMN     "action" TEXT,
ADD COLUMN     "employee_id" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'request',
ADD COLUMN     "response_json" JSONB;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_id" TEXT,
ADD COLUMN     "email_verified_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "email_verification_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_verification_codes_user_id_created_at_idx" ON "email_verification_codes"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idempotency_keys_kind_idx" ON "idempotency_keys"("kind");

-- AddForeignKey
ALTER TABLE "email_verification_codes" ADD CONSTRAINT "email_verification_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill waktu kejadian untuk data lama.
UPDATE "attendance" SET "capture_at" = "check_in_at", "synced_at" = "created_at"
WHERE "capture_at" IS NULL;

UPDATE "users" SET "email_verified_at" = "created_at", "approved_at" = "created_at"
WHERE "email_verified_at" IS NULL;

-- Normalkan device ACTIVE berlebih: pertahankan 2 dengan last_seen_at terbaru.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY "employee_id"
    ORDER BY "last_seen_at" DESC NULLS LAST, "registered_at" DESC
  ) AS rn
  FROM "devices"
  WHERE "status" = 'ACTIVE'
),
demoted AS (
  UPDATE "devices" d SET "status" = 'PENDING'
  FROM ranked r WHERE d.id = r.id AND r.rn > 2
  RETURNING d.id, d."employee_id"
)
INSERT INTO "audit_logs" ("id", "action", "target_type", "target_id", "result", "metadata", "timestamp")
SELECT
  'audit_' || md5(random()::text || demoted.id),
  'DEVICE_DEMOTED',
  'device',
  demoted.id,
  'SUCCESS',
  jsonb_build_object(
    'employeeId', demoted."employee_id",
    'oldStatus', 'ACTIVE',
    'newStatus', 'PENDING'
  ),
  CURRENT_TIMESTAMP
FROM demoted;

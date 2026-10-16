-- AlterTable: TOTP two-factor columns on users (secret PENDING until enabled)
ALTER TABLE "users" ADD COLUMN "totp_secret" TEXT;
ALTER TABLE "users" ADD COLUMN "totp_enabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: single-use TOTP recovery codes (only SHA-256 hashes stored)
CREATE TABLE "totp_recovery_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "totp_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "totp_recovery_codes_user_id_code_hash_key" ON "totp_recovery_codes"("user_id", "code_hash");
CREATE INDEX "totp_recovery_codes_user_id_idx" ON "totp_recovery_codes"("user_id");

-- AddForeignKey
ALTER TABLE "totp_recovery_codes" ADD CONSTRAINT "totp_recovery_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

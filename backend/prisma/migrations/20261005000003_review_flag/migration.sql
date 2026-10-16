-- AlterTable: supervisor review flag for MEDIUM-risk attendance (STEP 13)
ALTER TABLE "attendance" ADD COLUMN "needs_review" BOOLEAN NOT NULL DEFAULT false;

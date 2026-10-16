-- CreateTable: biometric consent per purpose (STEP 21, UU PDP)
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consents_employee_id_purpose_key" ON "consents"("employee_id", "purpose");
CREATE INDEX "consents_employee_id_idx" ON "consents"("employee_id");

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

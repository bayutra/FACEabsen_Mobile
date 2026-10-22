-- CreateTable
CREATE TABLE "handovers" (
    "id" TEXT NOT NULL,
    "hospital_id" TEXT NOT NULL,
    "department_id" TEXT,
    "from_employee_id" TEXT NOT NULL,
    "to_employee_id" TEXT,
    "title" TEXT NOT NULL,
    "patient_summary" TEXT,
    "pending_tasks" TEXT,
    "medications" TEXT,
    "incidents" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "acknowledged_by_id" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handovers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "handovers_hospital_id_idx" ON "handovers"("hospital_id");

-- CreateIndex
CREATE INDEX "handovers_department_id_idx" ON "handovers"("department_id");

-- CreateIndex
CREATE INDEX "handovers_from_employee_id_idx" ON "handovers"("from_employee_id");

-- CreateIndex
CREATE INDEX "handovers_status_idx" ON "handovers"("status");

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_hospital_id_fkey" FOREIGN KEY ("hospital_id") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_from_employee_id_fkey" FOREIGN KEY ("from_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_to_employee_id_fkey" FOREIGN KEY ("to_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handovers" ADD CONSTRAINT "handovers_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

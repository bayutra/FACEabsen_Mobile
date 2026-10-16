-- Perf indexes (M2/M3): open-punch lookup, work-date scans, audit feed.
-- The partial index for open punches cannot be expressed in Prisma DSL.
CREATE INDEX "attendance_open_per_employee" ON "attendance"("employee_id", "check_in_at" DESC) WHERE "check_out_at" IS NULL;
CREATE INDEX "attendance_work_date_idx" ON "attendance"("work_date");
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp" DESC);

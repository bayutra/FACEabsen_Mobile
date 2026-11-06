import type { ConfigService } from '@nestjs/config';

/**
 * Cap on simultaneously ACTIVE devices per employee (PRD FR-DEV-01).
 *
 * Registration itself keeps exactly one ACTIVE device (auto-replace); extra
 * devices may only be activated by an admin up to this cap. Both the
 * registration and the admin-activation flows guard the cap with
 * `pg_advisory_xact_lock(hashtext(employeeId))`.
 */
export function maxActiveDevicesPerEmployee(
  config?: Pick<ConfigService, 'get'>,
): number {
  const v = Number(config?.get?.('MAX_ACTIVE_DEVICES_PER_EMPLOYEE', 2) ?? 2);
  return Number.isFinite(v) && v > 0 ? v : 2;
}

-- Remove GPS/geofence entirely: attendance no longer stores a location proof
-- and hospitals no longer carry a perimeter. Dependents (lat-range / radius
-- CHECK constraints) are dropped automatically with their columns.

ALTER TABLE "attendance" DROP COLUMN IF EXISTS "check_in_lat";
ALTER TABLE "attendance" DROP COLUMN IF EXISTS "check_in_lon";
ALTER TABLE "attendance" DROP COLUMN IF EXISTS "check_in_accuracy";
ALTER TABLE "attendance" DROP COLUMN IF EXISTS "check_out_lat";
ALTER TABLE "attendance" DROP COLUMN IF EXISTS "check_out_lon";
ALTER TABLE "attendance" DROP COLUMN IF EXISTS "geofence_pass";

ALTER TABLE "hospitals" DROP COLUMN IF EXISTS "latitude";
ALTER TABLE "hospitals" DROP COLUMN IF EXISTS "longitude";
ALTER TABLE "hospitals" DROP COLUMN IF EXISTS "radius_meters";
ALTER TABLE "hospitals" DROP COLUMN IF EXISTS "geofence_max_accuracy_m";
ALTER TABLE "hospitals" DROP COLUMN IF EXISTS "geofence_max_skew_min";

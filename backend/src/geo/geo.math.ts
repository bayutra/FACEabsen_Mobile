/**
 * STEP 11 — server-side geo math (PRD §15-§17). Pure + unit-tested.
 * The server is the final decision maker; client fixes are untrusted input.
 */

const EARTH_M = 6371000;

export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(a));
}

export interface GeoFix {
  latitude: number;
  longitude: number;
  accuracyM: number;
  timestamp: Date;
  isMocked: boolean;
}

export interface Geofence {
  latitude: number;
  longitude: number;
  radiusM: number;
}

export interface GeoVerdict {
  inside: boolean;
  distanceM: number;
  radiusM: number;
  mockSuspected: boolean;
  checks: {
    coordsValid: boolean;
    accuracyOk: boolean;
    timestampFresh: boolean;
  };
}

export function coordsValid(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180 &&
    !(lat === 0 && lon === 0) // null-island = no fix
  );
}

export function validateFix(
  fix: GeoFix,
  fence: Geofence,
  opts: { maxAccuracyM: number; maxSkewMin: number; now?: Date },
): GeoVerdict {
  const valid = coordsValid(fix.latitude, fix.longitude);
  const accuracyOk = Number.isFinite(fix.accuracyM) && fix.accuracyM >= 0 && fix.accuracyM <= opts.maxAccuracyM;
  const now = opts.now ?? new Date();
  const timestampFresh =
    fix.timestamp instanceof Date &&
    !Number.isNaN(fix.timestamp.getTime()) &&
    Math.abs(now.getTime() - fix.timestamp.getTime()) <= opts.maxSkewMin * 60_000;
  const distanceM = valid ? haversineM(fix.latitude, fix.longitude, fence.latitude, fence.longitude) : NaN;
  const mockSuspected = fix.isMocked === true;
  const inside =
    valid && accuracyOk && timestampFresh && !mockSuspected && distanceM <= fence.radiusM;
  return { inside, distanceM, radiusM: fence.radiusM, mockSuspected, checks: { coordsValid: valid, accuracyOk, timestampFresh } };
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type RiskCategory = 'LOW' | 'MEDIUM' | 'HIGH';

/** Per-signal evidence. Unknown/unreached gates score 0 (fail-closed). */
export interface RiskInput {
  faceScore: number | null; // 0..1 cosine, null when never evaluated
  livenessOk: boolean;
  deviceOk: boolean;
  integrityOk: boolean;
  gpsOk: boolean;
  geofenceOk: boolean;
  signatureOk: boolean;
}

export interface RiskWeights {
  face: number;
  liveness: number;
  device: number;
  integrity: number;
  gps: number;
  geofence: number;
  signature: number;
}

/**
 * STEP 13 — Anti-titip-absen risk engine (PRD §23-§24, §58).
 * Fixed 100-point table; every weight and threshold is env-configurable
 * (documented in .env.example) for post-deployment calibration.
 */
@Injectable()
export class RiskService {
  readonly weights: RiskWeights;
  readonly lowMin: number;
  readonly mediumMin: number;
  readonly mediumReview: boolean;

  constructor(config: ConfigService) {
    const num = (key: string, dflt: number) => Number(config.get(key, dflt));
    this.weights = {
      face: num('RISK_W_FACE', 30),
      liveness: num('RISK_W_LIVENESS', 20),
      device: num('RISK_W_DEVICE', 15),
      integrity: num('RISK_W_INTEGRITY', 10),
      gps: num('RISK_W_GPS', 10),
      geofence: num('RISK_W_GEOFENCE', 10),
      signature: num('RISK_W_SIGNATURE', 5),
    };
    this.lowMin = num('RISK_LOW_MIN', 90);
    this.mediumMin = num('RISK_MEDIUM_MIN', 70);
    this.mediumReview = String(config.get('RISK_MEDIUM_REVIEW', 'true')).toLowerCase() !== 'false';
    if (!(this.lowMin > this.mediumMin)) {
      throw new Error('RISK_LOW_MIN must be greater than RISK_MEDIUM_MIN');
    }
  }

  score(input: RiskInput): { score: number; category: RiskCategory } {
    const w = this.weights;
    const face = Math.max(0, Math.min(1, input.faceScore ?? 0)) * w.face;
    const total =
      face +
      (input.livenessOk ? w.liveness : 0) +
      (input.deviceOk ? w.device : 0) +
      (input.integrityOk ? w.integrity : 0) +
      (input.gpsOk ? w.gps : 0) +
      (input.geofenceOk ? w.geofence : 0) +
      (input.signatureOk ? w.signature : 0);
    const score = Math.round(total);
    const category: RiskCategory =
      score >= this.lowMin ? 'LOW' : score >= this.mediumMin ? 'MEDIUM' : 'HIGH';
    return { score, category };
  }

  /** MEDIUM passes but is flagged for supervisor review (queue: STEP 17). */
  needsReview(category: RiskCategory): boolean {
    return category === 'MEDIUM' && this.mediumReview;
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type RiskCategory = 'LOW' | 'MEDIUM' | 'HIGH';

 
export interface RiskInput {
  faceScore: number | null; 
  livenessOk: boolean;
  deviceOk: boolean;
  integrityOk: boolean;
  signatureOk: boolean;
}

export interface RiskWeights {
  face: number;
  liveness: number;
  device: number;
  integrity: number;
  signature: number;
}

 
@Injectable()
export class RiskService {
  readonly weights: RiskWeights;
  readonly lowMin: number;
  readonly mediumMin: number;
  readonly mediumReview: boolean;

  constructor(config: ConfigService) {
    const num = (key: string, dflt: number) => Number(config.get(key, dflt));
    this.weights = {
      face: num('RISK_W_FACE', 45),
      liveness: num('RISK_W_LIVENESS', 20),
      device: num('RISK_W_DEVICE', 15),
      integrity: num('RISK_W_INTEGRITY', 15),
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
      (input.signatureOk ? w.signature : 0);
    const score = Math.round(total);
    const category: RiskCategory =
      score >= this.lowMin ? 'LOW' : score >= this.mediumMin ? 'MEDIUM' : 'HIGH';
    return { score, category };
  }

   
  needsReview(category: RiskCategory): boolean {
    return category === 'MEDIUM' && this.mediumReview;
  }
}

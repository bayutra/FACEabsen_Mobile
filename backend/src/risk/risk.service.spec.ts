import { describe, expect, it } from 'vitest';
import { RiskService, type RiskInput } from './risk.service.js';

const cfg = (over: Record<string, unknown> = {}) =>
  ({ get: (k: string, d: unknown) => (k in over ? over[k] : d) }) as never;

const full: RiskInput = {
  faceScore: 0.95,
  livenessOk: true,
  deviceOk: true,
  integrityOk: true,
  gpsOk: true,
  geofenceOk: true,
  signatureOk: true,
};

describe('RiskService PRD §23 table', () => {
  it('perfect signals score 100 LOW', () => {
    const svc = new RiskService(cfg());
    expect(svc.score({ ...full, faceScore: 1 })).toEqual({ score: 100, category: 'LOW' });
  });

  it('typical good face (0.9) stays LOW', () => {
    expect(new RiskService(cfg()).score({ ...full, faceScore: 0.9 })).toEqual({ score: 97, category: 'LOW' });
  });

  it('borderline face (0.5) drops to MEDIUM and flags review', () => {
    const svc = new RiskService(cfg());
    const r = svc.score({ ...full, faceScore: 0.5 });
    expect(r).toEqual({ score: 85, category: 'MEDIUM' });
    expect(svc.needsReview(r.category)).toBe(true);
    expect(svc.needsReview('LOW')).toBe(false);
    expect(svc.needsReview('HIGH')).toBe(false);
  });

  it('outside geofence with mock scores HIGH', () => {
    const r = new RiskService(cfg()).score({
      ...full,
      faceScore: null, // never evaluated
      gpsOk: true, // fix itself valid…
      geofenceOk: false, // …but outside
    });
    // 0 + 20 + 15 + 10 + 10 + 0 + 5 = 60
    expect(r).toEqual({ score: 60, category: 'HIGH' });
  });

  it('total failure scores 0 HIGH', () => {
    const r = new RiskService(cfg()).score({
      faceScore: null,
      livenessOk: false,
      deviceOk: false,
      integrityOk: false,
      gpsOk: false,
      geofenceOk: false,
      signatureOk: false,
    });
    expect(r).toEqual({ score: 0, category: 'HIGH' });
  });

  it('weights and thresholds are configurable; bad thresholds fail fast', () => {
    const svc = new RiskService(cfg({ RISK_W_FACE: 50, RISK_LOW_MIN: 95, RISK_MEDIUM_MIN: 80 }));
    expect(svc.score({ ...full, faceScore: 1 })).toEqual({ score: 120, category: 'LOW' });
    expect(() => new RiskService(cfg({ RISK_LOW_MIN: 70, RISK_MEDIUM_MIN: 70 }))).toThrow(
      'RISK_LOW_MIN',
    );
  });

  it('medium review can be disabled', () => {
    const svc = new RiskService(cfg({ RISK_MEDIUM_REVIEW: 'false' }));
    expect(svc.needsReview('MEDIUM')).toBe(false);
  });
});

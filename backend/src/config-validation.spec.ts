import { describe, expect, it } from 'vitest';
import { validateEnv } from './config-validation.js';

describe('validateEnv numeric bounds (M13)', () => {
  it('passes with defaults (missing vars)', () => {
    expect(() => validateEnv({})).not.toThrow();
  });

  it('rejects FACE_MATCH_THRESHOLD outside (0, 1]', () => {
    expect(() => validateEnv({ FACE_MATCH_THRESHOLD: '0' })).toThrow(
      'FACE_MATCH_THRESHOLD',
    );
    expect(() => validateEnv({ FACE_MATCH_THRESHOLD: '1.5' })).toThrow(
      'FACE_MATCH_THRESHOLD',
    );
    expect(() => validateEnv({ FACE_MATCH_THRESHOLD: 'abc' })).toThrow(
      'FACE_MATCH_THRESHOLD',
    );
    expect(() => validateEnv({ FACE_MATCH_THRESHOLD: '0.5' })).not.toThrow();
    expect(() => validateEnv({ FACE_MATCH_THRESHOLD: '1' })).not.toThrow();
  });

  it('rejects non-positive liveness/skew bounds', () => {
    expect(() => validateEnv({ LIVENESS_MAX_AGE_MIN: '0' })).toThrow(
      'LIVENESS_MAX_AGE_MIN',
    );
    expect(() => validateEnv({ REQUEST_MAX_SKEW_MIN: '0' })).toThrow(
      'REQUEST_MAX_SKEW_MIN',
    );
  });

  it('rejects risk weights not summing to 100', () => {
    expect(() => validateEnv({ RISK_W_FACE: '50' })).toThrow('RISK_W_');
    expect(() => validateEnv({ RISK_W_FACE: '45' })).not.toThrow();
  });

  it('rejects RISK_LOW_MIN <= RISK_MEDIUM_MIN', () => {
    expect(() =>
      validateEnv({ RISK_LOW_MIN: '70', RISK_MEDIUM_MIN: '70' }),
    ).toThrow('RISK_LOW_MIN');
    expect(() =>
      validateEnv({ RISK_LOW_MIN: '60', RISK_MEDIUM_MIN: '70' }),
    ).toThrow('RISK_LOW_MIN');
    expect(() =>
      validateEnv({ RISK_LOW_MIN: '90', RISK_MEDIUM_MIN: '70' }),
    ).not.toThrow();
  });
});




import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync, ValidationError } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { AdminHistoryQuery, CheckInDto, LivenessAttestationDto } from './dto.js';

 
 
const PIPE_OPTS = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
} as const;

function validateLiveness(input: Record<string, unknown>) {
  const dto = plainToInstance(LivenessAttestationDto, input, { enableImplicitConversion: true });
  return validateSync(dto, PIPE_OPTS);
}

describe('LivenessAttestationDto', () => {
  const base = {
    passed: true,
    completedAt: new Date().toISOString(),
    score: 1,
  };

  it('accepts a passive attestation with a padScore and no challenges', () => {
    expect(validateLiveness({ ...base, mode: 'passive', padScore: 0.84 })).toHaveLength(0);
  });

  it('accepts the legacy active attestation with a challenge list', () => {
    expect(validateLiveness({ ...base, mode: 'active', challenges: ['blink'] })).toHaveLength(0);
  });

  it('still accepts an attestation that omits mode entirely', () => {
    expect(validateLiveness({ ...base, challenges: ['blink'] })).toHaveLength(0);
  });

  it('rejects an unknown mode rather than passing it through', () => {
    const errors = validateLiveness({ ...base, mode: 'trust-me', padScore: 0.9 });
    expect(errors.some((e) => e.property === 'mode')).toBe(true);
  });

  it('rejects an out-of-range padScore', () => {
    expect(validateLiveness({ ...base, mode: 'passive', padScore: 5 }).length).toBeGreaterThan(0);
    expect(validateLiveness({ ...base, mode: 'passive', padScore: -1 }).length).toBeGreaterThan(0);
  });

  it('rejects a non-ISO completedAt', () => {
    expect(validateLiveness({ ...base, completedAt: 'yesterday', challenges: ['blink'] }).length)
      .toBeGreaterThan(0);
  });

  it('does not demand a challenge list in passive mode', () => {
    
    expect(validateLiveness({ ...base, mode: 'passive', padScore: 0.5 }).length).toBe(0);
  });
});

describe('CheckInDto nesting', () => {
  const checkIn = (liveness: Record<string, unknown>) =>
    plainToInstance(
      CheckInDto,
      {
        deviceId: 'dev-1',
        faceEmbedding: Array(192).fill(0.1),
        liveness,
        requestId: '11111111-2222-3333-4444-555555555555',
        requestTimestamp: new Date().toISOString(),
        signature: 'c2ln',
        deviceCompromised: false,
      },
      { enableImplicitConversion: true },
    );

  it('passes a passive check-in body through validation', () => {
    const errors = validateSync(checkIn({
      passed: true,
      mode: 'passive',
      completedAt: new Date().toISOString(),
      score: 1,
      padScore: 0.9,
    }), { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.filter((e) => e.property === 'liveness')).toHaveLength(0);
  });

  it('flags an unknown key inside the nested liveness object', () => {
    
    const errors = validateSync(checkIn({
      passed: true,
      mode: 'passive',
      completedAt: new Date().toISOString(),
      score: 1,
      padScore: 0.9,
      sneaky: true,
    }), PIPE_OPTS);
    
    
    const flat: ValidationError[] = [];
    const walk = (list: ValidationError[]) => {
      for (const e of list) {
        flat.push(e);
        if (e.children?.length) walk(e.children);
      }
    };
    walk(errors);
    expect(flat.some((e) => e.property === 'sneaky')).toBe(true);
  });
});

describe('AdminHistoryQuery needsReview flag', () => {
  const validateQuery = (input: Record<string, unknown>) => {
    const dto = plainToInstance(AdminHistoryQuery, input);
    return { dto, errors: validateSync(dto, PIPE_OPTS) };
  };

  it('parses \'false\' as false instead of inverting to true', () => {
    const { dto, errors } = validateQuery({ needsReview: 'false' });
    expect(errors).toHaveLength(0);
    expect(dto.needsReview).toBe(false);
    const { dto: dtoT, errors: errorsT } = validateQuery({ needsReview: 'true' });
    expect(errorsT).toHaveLength(0);
    expect(dtoT.needsReview).toBe(true);
  });

  it('rejects garbage instead of silently inverting', () => {
    const { errors } = validateQuery({ needsReview: 'yes' });
    expect(errors.some((e) => e.property === 'needsReview')).toBe(true);
  });
});

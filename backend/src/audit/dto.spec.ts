import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { ListAuditQuery } from './dto.js';

const PIPE_OPTS = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
} as const;

function validate(input: Record<string, unknown>) {
  const dto = plainToInstance(ListAuditQuery, input);
  return { dto, errors: validateSync(dto, PIPE_OPTS) };
}

describe('ListAuditQuery security flag', () => {
  it("parses 'false' as false instead of inverting to true", () => {
    const { dto, errors } = validate({ security: 'false' });
    expect(errors).toHaveLength(0);
    expect(dto.security).toBe(false);
    const { dto: dtoT, errors: errorsT } = validate({ security: 'true' });
    expect(errorsT).toHaveLength(0);
    expect(dtoT.security).toBe(true);
  });

  it('rejects garbage instead of silently inverting', () => {
    const { errors } = validate({ security: 'yes' });
    expect(errors.some((e) => e.property === 'security')).toBe(true);
  });
});

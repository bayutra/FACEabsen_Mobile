import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { CreateUserDto, ListUsersQuery, UpdateUserDto } from './dto.js';

const PIPE_OPTS = {
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
} as const;

function validate<T extends object>(
  cls: new () => T,
  input: Record<string, unknown>,
) {
  const dto = plainToInstance(cls, input);
  return validateSync(dto, PIPE_OPTS).map(
    (e) => `${e.property}: ${e.constraints}`,
  );
}

describe('UpdateUserDto roles array', () => {
  it('accepts a single-element role array', () => {
    expect(validate(UpdateUserDto, { roles: ['SUPERVISOR'] })).toHaveLength(0);
  });

  it('accepts several roles and no roles at all', () => {
    expect(
      validate(UpdateUserDto, { roles: ['EMPLOYEE', 'ADMIN'] }),
    ).toHaveLength(0);
    expect(validate(UpdateUserDto, { isActive: false })).toHaveLength(0);
  });

  it('still rejects an unknown role and a non-array', () => {
    expect(validate(UpdateUserDto, { roles: ['ROOT'] }).join()).toContain(
      'roles',
    );
    expect(validate(UpdateUserDto, { roles: 'ADMIN' }).join()).toContain(
      'roles',
    );
  });

  it('accepts a boolean isActive', () => {
    expect(validate(UpdateUserDto, { isActive: true })).toHaveLength(0);
    expect(validate(UpdateUserDto, { isActive: false })).toHaveLength(0);
  });

  it('coerces rather than rejects a non-boolean isActive', () => {
    const dto = plainToInstance(
      UpdateUserDto,
      { isActive: 'yes' },
      {
        enableImplicitConversion: true,
      },
    );
    expect(validateSync(dto, PIPE_OPTS)).toHaveLength(0);
    expect(dto.isActive).toBe(true);
  });
});

describe('CreateUserDto', () => {
  it('accepts a well-formed account', () => {
    expect(
      validate(CreateUserDto, {
        email: 'it@rs.test',
        password: 'Password123!',
        roles: ['SUPERVISOR'],
      }),
    ).toHaveLength(0);
  });

  it('rejects a bad email, a short password and an unknown role', () => {
    expect(
      validate(CreateUserDto, {
        email: 'nope',
        password: 'Password123!',
      }).join(),
    ).toContain('email');
    expect(
      validate(CreateUserDto, { email: 'a@b.co', password: 'short' }).join(),
    ).toContain('password');
    expect(
      validate(CreateUserDto, {
        email: 'a@b.co',
        password: 'Password123!',
        roles: ['ROOT'],
      }).join(),
    ).toContain('roles');
  });
});

describe('ListUsersQuery', () => {
  it('coerces the numeric filters and accepts a role', () => {
    expect(
      validate(ListUsersQuery, { page: '2', pageSize: '50' }),
    ).toHaveLength(0);
    expect(validate(ListUsersQuery, { role: 'ADMIN' })).toHaveLength(0);
  });

  it('rejects an unknown role and an out-of-range page', () => {
    expect(validate(ListUsersQuery, { role: 'ROOT' }).join()).toContain('role');
    expect(validate(ListUsersQuery, { page: '0' }).join()).toContain('page');
    expect(validate(ListUsersQuery, { pageSize: '500' }).join()).toContain(
      'pageSize',
    );
  });

  it('parses boolean query flags without inversion', () => {
    const t = plainToInstance(ListUsersQuery, { isActive: 'true' });
    expect(t.isActive).toBe(true);
    expect(validate(ListUsersQuery, { isActive: 'true' })).toHaveLength(0);
    const f = plainToInstance(ListUsersQuery, { isActive: 'false' });
    expect(f.isActive).toBe(false);
    expect(validate(ListUsersQuery, { isActive: 'false' })).toHaveLength(0);
  });

  it('rejects garbage boolean flags instead of inverting them', () => {
    expect(validate(ListUsersQuery, { isActive: 'yes' }).join()).toContain(
      'isActive',
    );
    expect(validate(ListUsersQuery, { isActive: '0' }).join()).toContain(
      'isActive',
    );
  });
});

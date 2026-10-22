import { BadRequestException } from '@nestjs/common';
import { AUTH_POLICY } from './constants.js';

export function validatePasswordPolicy(password: string): void {
  const problems: string[] = [];
  if (password.length < AUTH_POLICY.password.minLength) {
    problems.push(`minimum length ${AUTH_POLICY.password.minLength}`);
  }
  if (!/[a-z]/.test(password)) problems.push('at least one lowercase letter');
  if (!/[A-Z]/.test(password)) problems.push('at least one uppercase letter');
  if (!/[0-9]/.test(password)) problems.push('at least one digit');
  if (problems.length > 0) {
    throw new BadRequestException(`Weak password: ${problems.join(', ')}`);
  }
}

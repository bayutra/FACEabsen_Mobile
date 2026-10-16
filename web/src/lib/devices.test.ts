import { describe, expect, it } from 'vitest';
import { deviceStatusLabel, toDeviceQueryString } from './devices';

describe('toDeviceQueryString', () => {
  it('drops empties', () => {
    expect(toDeviceQueryString({})).toBe('');
    expect(toDeviceQueryString({ page: 1, search: '  ' })).toBe('');
    expect(toDeviceQueryString({ status: 'REVOKED', search: 'j2' })).toBe(
      '?status=REVOKED&search=j2',
    );
  });
});

describe('deviceStatusLabel', () => {
  it('covers all PRD §10 statuses in Indonesian', () => {
    expect(deviceStatusLabel('PENDING')).toBe('Menunggu');
    expect(deviceStatusLabel('ACTIVE')).toBe('Aktif');
    expect(deviceStatusLabel('REVOKED')).toBe('Dicabut');
    expect(deviceStatusLabel('LOST')).toBe('Hilang');
    expect(deviceStatusLabel('REPLACED')).toBe('Diganti');
  });
});

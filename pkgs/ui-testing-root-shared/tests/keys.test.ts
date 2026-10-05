import { describe, expect, test } from 'bun:test';
import type { DriverKey } from '@pkgs/ui-testing-root-shared/keys';
import { DRIVER_KEY_TO_DOM } from '@pkgs/ui-testing-root-shared/keys';

/**
 * The portable key table is the contract every driver maps through, so a key
 * added to {@link DriverKey} without a DOM identifier must fail here rather
 * than at `undefined` dispatch time inside a host.
 */
describe('driver keys', () => {
  test('every portable key has a DOM identifier', () => {
    for (const [key, domKey] of Object.entries(DRIVER_KEY_TO_DOM)) {
      expect(typeof domKey).toBe('string');
      expect(domKey.length).toBeGreaterThan(0);
      expect(key.length).toBeGreaterThan(0);
    }
  });

  test('DOM identifiers are unique, so the reverse map is unambiguous', () => {
    const values = Object.values(DRIVER_KEY_TO_DOM);
    expect(new Set(values).size).toBe(values.length);
  });

  test('document-scope navigation keys are portable', () => {
    const navigation: readonly DriverKey[] = [
      'arrowLeft',
      'arrowRight',
      'home',
      'end',
    ];
    expect(navigation.map((key) => DRIVER_KEY_TO_DOM[key])).toEqual([
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
    ]);
  });
});

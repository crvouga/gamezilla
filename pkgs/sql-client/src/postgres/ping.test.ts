import { describe, expect, test } from 'bun:test';
import { isTransientPingError } from './ping';

describe('isTransientPingError', () => {
  test('treats Connection terminated unexpectedly as transient', () => {
    expect(
      isTransientPingError(new Error('Connection terminated unexpectedly'))
    ).toBe(true);
  });

  test('treats node network codes as transient', () => {
    const err = new Error('connect ECONNRESET');
    (err as { code?: string }).code = 'ECONNRESET';
    expect(isTransientPingError(err)).toBe(true);
  });

  test('does not retry password authentication failures', () => {
    expect(
      isTransientPingError(
        new Error('password authentication failed for user "neondb_owner"')
      )
    ).toBe(false);
  });

  test('does not retry missing database', () => {
    expect(
      isTransientPingError(new Error('database "missing" does not exist'))
    ).toBe(false);
  });
});

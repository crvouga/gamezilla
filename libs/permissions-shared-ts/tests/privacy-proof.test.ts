import { expect, test } from 'bun:test';
import { decidePrivacyAccess } from '@libs/permissions-shared-ts/privacy-permission';

test('privacy proof requires an elapsed age strictly below ten minutes', () => {
  const allowed = { allowed: true, policyVersion: 'fixture' };
  for (const authenticatedAtMs of [1, 0, -1, null, 600_001, Number.NaN]) {
    const decision = decidePrivacyAccess(allowed, {
      connected: true,
      nowMs: 600_000,
      authenticatedAtMs,
    });
    expect(decision.allowed).toBe(authenticatedAtMs === 1);
  }
  const guest = {
    allowed: false,
    reason: 'requires_account' as const,
    policyVersion: 'fixture',
  };
  expect(
    decidePrivacyAccess(guest, {
      connected: false,
      nowMs: 0,
      authenticatedAtMs: 0,
    })
  ).toEqual(guest);
  expect(
    decidePrivacyAccess(allowed, {
      connected: false,
      nowMs: 0,
      authenticatedAtMs: 0,
    }).reason
  ).toBe('requires_connection');
});

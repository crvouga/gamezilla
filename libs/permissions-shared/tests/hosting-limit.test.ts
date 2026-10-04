// regression: space-hosting-limit-unenforced
/**
 * Guests had no hosting limit (`null`) and nothing decided the free one, so
 * anyone could host any number of spaces. The literal cases: holding one live
 * space, a guest or a free account is refused a second with `limit_reached`
 * and an invitation to Plus; a Plus member is not; an ended space (0 held)
 * frees the place.
 */
import { describe, expect, test } from 'bun:test';

import { LIMIT } from '@libs/permissions-shared/permission-catalog';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions-shared/permission-policy';
import {
  decideLimit,
  resolveUnlockRef,
} from '@pkgs/permissions-shared/decision';
import type { Facts } from '@pkgs/permissions-shared/facts';
import { resolveSubject } from '@pkgs/permissions-shared/resolve';

const GUEST: Facts = { auth: 'anonymous', membership: 'none' };
const FREE: Facts = { auth: 'verified', membership: 'none' };
const PLUS: Facts = { auth: 'verified', membership: 'active' };

function hosting(facts: Facts, held: number) {
  return decideLimit(
    DEFAULT_PERMISSION_POLICY,
    resolveSubject(DEFAULT_PERMISSION_POLICY, facts),
    LIMIT.hostedSpaces,
    held
  );
}

describe('hosting limit', () => {
  test('a guest hosting one space is invited to Plus for another', () => {
    const decision = hosting(GUEST, 1);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('limit_reached');
    expect(
      resolveUnlockRef(DEFAULT_PERMISSION_POLICY, decision.unlockRef ?? '')
        ?.ctaTarget
    ).toBe('billing');
  });

  test('a free account hosting one space is invited to Plus for another', () => {
    const decision = hosting(FREE, 1);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('limit_reached');
    expect(
      resolveUnlockRef(DEFAULT_PERMISSION_POLICY, decision.unlockRef ?? '')
        ?.ctaTarget
    ).toBe('billing');
  });

  test('an ended space frees the place', () => {
    expect(hosting(GUEST, 0).allowed).toBe(true);
    expect(hosting(FREE, 0).allowed).toBe(true);
  });

  test('a Plus member hosts a second space', () => {
    expect(hosting(PLUS, 1).allowed).toBe(true);
  });
});

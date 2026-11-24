import { describe, expect, test } from 'bun:test';
import { matchedGamesLeftShown } from '@libs/permissions-shared-ts/matched-game-allowance';
import {
  DEFAULT_PERMISSION_POLICY,
  GUEST_MATCHED_GAMES_PER_DAY,
  MATCHED_GAMES_LEFT_SHOWN_AT,
} from '@libs/permissions-shared-ts/permission-policy';
import { policyAt } from '@pkgs/permissions-shared-ts/policy';
import { resolveSubject } from '@pkgs/permissions-shared-ts/resolve';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const DAY_MS = 86_400_000;
const NOW = Date.parse('2026-09-19T12:00:00.000Z');
const MIDNIGHT = Math.floor(NOW / DAY_MS) * DAY_MS;
const POLICY = policyAt(DEFAULT_PERMISSION_POLICY, NOW);
const GUEST = resolveSubject(POLICY, { auth: 'anonymous', membership: 'none' });
const ACCOUNT = resolveSubject(POLICY, {
  auth: 'verified',
  membership: 'none',
});

/** `today` matched games begun today and `earlier` begun before today. */
function begun(today: number, earlier: number): readonly string[] {
  return [
    ...Array.from({ length: today }, () => new Date(MIDNIGHT).toISOString()),
    ...Array.from({ length: earlier }, () =>
      new Date(MIDNIGHT - 1).toISOString()
    ),
  ];
}

const counts = fc.record({
  today: fc.integer({ min: 0, max: GUEST_MATCHED_GAMES_PER_DAY + 3 }),
  earlier: fc.integer({ min: 0, max: 30 }),
});

describe('matched games left today', () => {
  test('a guest is told what is left only when 1 to 3 matched games are', () => {
    assertProperty(
      'a guest is told what is left only when 1 to 3 matched games are',
      fc.property(counts, ({ today, earlier }) => {
        const left = Math.max(0, GUEST_MATCHED_GAMES_PER_DAY - today);
        const shown = matchedGamesLeftShown(POLICY, GUEST, {
          startedAt: begun(today, earlier),
          nowMs: NOW,
        });
        const told = left >= 1 && left <= MATCHED_GAMES_LEFT_SHOWN_AT;
        expect(shown?.left ?? null).toBe(told ? left : null);
        // Its way forward is the refusal past what is left: signing in.
        if (shown !== null)
          expect(shown.unlock).toMatchObject({
            allowed: false,
            reason: 'quota_exhausted',
          });
      })
    );
  });

  test('an account is never told how many matched games are left', () => {
    assertProperty(
      'an account is never told how many matched games are left',
      fc.property(counts, ({ today, earlier }) => {
        expect(
          matchedGamesLeftShown(POLICY, ACCOUNT, {
            startedAt: begun(today, earlier),
            nowMs: NOW,
          })
        ).toBeNull();
      })
    );
  });
});

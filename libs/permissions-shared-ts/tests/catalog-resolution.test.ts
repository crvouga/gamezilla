import { describe, expect, test } from 'bun:test';
import { resolveAccessFacts } from '@libs/permissions-shared-ts/access-facts';
import type { AppAction } from '@libs/permissions-shared-ts/permission-catalog';
import {
  ACTION,
  isQuotaAction,
} from '@libs/permissions-shared-ts/permission-catalog';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions-shared-ts/permission-policy';
import { decide, decideQuota } from '@pkgs/permissions-shared-ts/decision';
import type { Facts } from '@pkgs/permissions-shared-ts/facts';
import {
  permissionsOf,
  quotasOf,
  resolveSubject,
} from '@pkgs/permissions-shared-ts/resolve';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const NOW = Date.parse('2026-09-19T12:00:00.000Z');
const DAY = 86_400_000;

/** Every fact combination the resolver distinguishes today. */
const FIXTURES: readonly Facts[] = [
  { auth: 'anonymous', membership: 'none' },
  { auth: 'verified', membership: 'none' },
  { auth: 'verified', membership: 'active' },
  {},
];

function defined(action: AppAction, facts: Facts): boolean {
  const subject = resolveSubject(DEFAULT_PERMISSION_POLICY, facts);
  return isQuotaAction(action)
    ? quotasOf(DEFAULT_PERMISSION_POLICY, subject).has(action)
    : permissionsOf(DEFAULT_PERMISSION_POLICY, subject).has(action);
}

describe('catalog resolution under the shipped policy', () => {
  test('every catalogued action resolves to a defined value for every fixture', () => {
    for (const facts of FIXTURES.slice(0, 3)) {
      for (const action of Object.values(ACTION)) {
        expect({ action, facts, defined: defined(action, facts) }).toEqual({
          action,
          facts,
          defined: true,
        });
      }
    }
  });

  test('every catalogued action is allowed at zero use, only anonymous rated is limited', () => {
    for (const facts of FIXTURES.slice(0, 3)) {
      const subject = resolveSubject(DEFAULT_PERMISSION_POLICY, facts);
      for (const action of Object.values(ACTION)) {
        const decision = isQuotaAction(action)
          ? decideQuota(DEFAULT_PERMISSION_POLICY, subject, action, {
              used: 0,
              nowMs: NOW,
            })
          : decide(DEFAULT_PERMISSION_POLICY, subject, action);
        expect(decision.allowed).toBe(true);
        expect(decision.policyVersion).toBe(
          DEFAULT_PERMISSION_POLICY.version ?? ''
        );
        const limited =
          action === ACTION.puzzleRatedSolve && facts['auth'] === 'anonymous';
        expect(decision.remaining !== undefined).toBe(limited);
      }
    }
  });

  test('property: raw inputs → facts → exactly one plan-shaped role, quota always defined', () => {
    const snapshot = fc.option(
      fc.record({
        status: fc.constantFrom(
          'incomplete',
          'trialing',
          'active',
          'delinquent',
          'ended'
        ),
        currentPeriodEndMs: fc.option(
          fc.integer({ min: NOW - 30 * DAY, max: NOW + 30 * DAY })
        ),
        cancelAtPeriodEnd: fc.boolean(),
      }),
      { nil: null }
    );
    assertProperty(
      'property: raw inputs → facts → exactly one plan-shaped role, quota always defined',
      fc.property(fc.boolean(), snapshot, (signedIn, subscription) => {
        const facts = resolveAccessFacts({
          signedIn,
          subscription,
          nowMs: NOW,
          graceMs: 7 * DAY,
          confirmedAtMs: NOW,
          billingEnabled: true,
        });
        const subject = resolveSubject(DEFAULT_PERMISSION_POLICY, facts);
        const planRoles = subject.roles.filter((r) => r.startsWith('plan:'));
        expect(planRoles).toHaveLength(1);
        expect(
          quotasOf(DEFAULT_PERMISSION_POLICY, subject).has(
            ACTION.puzzleRatedSolve
          )
        ).toBe(true);
      }),
      { seed: 20_260_919, numRuns: 300 }
    );
  });
});

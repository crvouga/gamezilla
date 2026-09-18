// goal:guest-free-and-paid:1
// goal:guest-free-and-paid:2
// goal:guest-free-and-paid:3
// goal:guest-free-and-paid:4
// goal:guest-free-and-paid:10
// goal:always-true:4
// goal:always-true:5
// goal:always-true:6
// goal:room-to-grow:3
import { describe, expect, test } from 'bun:test';

import {
  DEFAULT_LIMITS_SPEC,
  evaluateLimit,
  isFeatureAllowed,
  type LimitsSpec,
  resolveTier,
} from '@pkgs/entitlements';

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_MS = 7 * DAY_MS;

describe('resolveTier', () => {
  test('signed-out is a guest, signed-in without a plan is free', () => {
    expect(
      resolveTier({
        signedIn: false,
        subscription: null,
        nowMs: 0,
        graceMs: GRACE_MS,
      })
    ).toBe('guest');
    expect(
      resolveTier({
        signedIn: true,
        subscription: null,
        nowMs: 0,
        graceMs: GRACE_MS,
      })
    ).toBe('free');
  });

  test('an active or trialing subscription is paid', () => {
    for (const status of ['active', 'trialing']) {
      expect(
        resolveTier({
          signedIn: true,
          subscription: {
            status,
            currentPeriodEndMs: null,
            cancelAtPeriodEnd: false,
          },
          nowMs: 0,
          graceMs: GRACE_MS,
        })
      ).toBe('paid');
    }
  });

  test('a canceled subscription keeps paid access through the grace window', () => {
    const subscription = {
      status: 'canceled',
      currentPeriodEndMs: 1000,
      cancelAtPeriodEnd: true,
    };
    expect(
      resolveTier({
        signedIn: true,
        subscription,
        nowMs: 1000 + GRACE_MS,
        graceMs: GRACE_MS,
      })
    ).toBe('paid');
    expect(
      resolveTier({
        signedIn: true,
        subscription,
        nowMs: 1000 + GRACE_MS + 1,
        graceMs: GRACE_MS,
      })
    ).toBe('free');
  });

  test('past due, unpaid and refunded subscriptions fall back to free', () => {
    for (const status of ['past_due', 'unpaid', 'incomplete_expired']) {
      expect(
        resolveTier({
          signedIn: true,
          subscription: {
            status,
            currentPeriodEndMs: 0,
            cancelAtPeriodEnd: false,
          },
          nowMs: 10 * DAY_MS,
          graceMs: GRACE_MS,
        })
      ).toBe('free');
    }
  });
});

describe('evaluateLimit', () => {
  test('guests are capped per day; the cap is exclusive', () => {
    expect(
      evaluateLimit({
        tier: 'guest',
        spec: DEFAULT_LIMITS_SPEC,
        feature: 'puzzlesPerDay',
        usage: 19,
      })
    ).toEqual({ allowed: true, limit: 20, remaining: 1 });
    expect(
      evaluateLimit({
        tier: 'guest',
        spec: DEFAULT_LIMITS_SPEC,
        feature: 'puzzlesPerDay',
        usage: 20,
      })
    ).toEqual({ allowed: false, limit: 20, remaining: 0 });
  });

  test('paid never hits a usage limit', () => {
    expect(
      evaluateLimit({
        tier: 'paid',
        spec: DEFAULT_LIMITS_SPEC,
        feature: 'puzzlesPerDay',
        usage: 1_000_000,
      })
    ).toEqual({ allowed: true, limit: null, remaining: null });
  });

  test('the evaluation is pure — the same inputs always agree', () => {
    const first = evaluateLimit({
      tier: 'free',
      spec: DEFAULT_LIMITS_SPEC,
      feature: 'maxHostedSpaces',
      usage: 1,
    });
    const second = evaluateLimit({
      tier: 'free',
      spec: DEFAULT_LIMITS_SPEC,
      feature: 'maxHostedSpaces',
      usage: 1,
    });
    expect(first).toEqual({ allowed: false, limit: 1, remaining: 0 });
    expect(second).toEqual(first);
  });

  test('feature gates differ per tier', () => {
    expect(
      isFeatureAllowed({
        tier: 'guest',
        spec: DEFAULT_LIMITS_SPEC,
        feature: 'canUseFriends',
      })
    ).toBe(false);
    expect(
      isFeatureAllowed({
        tier: 'free',
        spec: DEFAULT_LIMITS_SPEC,
        feature: 'canUseFriends',
      })
    ).toBe(true);
    expect(
      isFeatureAllowed({
        tier: 'guest',
        spec: DEFAULT_LIMITS_SPEC,
        feature: 'canWatch',
      })
    ).toBe(true);
  });
});

describe('limits are data', () => {
  test('a new feature and a changed cap need no code change', () => {
    const spec: LimitsSpec = {
      ...DEFAULT_LIMITS_SPEC,
      free: { ...DEFAULT_LIMITS_SPEC.free, puzzlesPerDay: 5 },
    };
    expect(
      evaluateLimit({
        tier: 'free',
        spec,
        feature: 'puzzlesPerDay',
        usage: 5,
      })
    ).toEqual({ allowed: false, limit: 5, remaining: 0 });
    expect(DEFAULT_LIMITS_SPEC.free.puzzlesPerDay).toBeNull();
  });
});

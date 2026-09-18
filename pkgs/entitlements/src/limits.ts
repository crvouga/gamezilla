import type { Tier } from './tier';

/** Configurable per-tier policy. Every value is data (client_config). */
export type TierLimits = {
  /** Counted cap for a UTC day; `null` means no limit. */
  readonly puzzlesPerDay: number | null;
  readonly canHost: boolean;
  readonly canJoin: boolean;
  readonly canWatch: boolean;
  readonly canUseFriends: boolean;
  readonly canCustomizeFeed: boolean;
  /** Counted cap on concurrently hosted spaces; `null` means no limit. */
  readonly maxHostedSpaces: number | null;
};

export type LimitsSpec = Readonly<Record<Tier, TierLimits>>;

/** Feature flags that can be gated per tier. */
export type FeatureGate =
  | 'canHost'
  | 'canJoin'
  | 'canWatch'
  | 'canUseFriends'
  | 'canCustomizeFeed';

/** v1 decision: a paid person offline keeps access for seven days. */
export const DEFAULT_BILLING_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/** Counted limits evaluated as `usage < limit`. */
export type CountedLimitFeature = 'puzzlesPerDay' | 'maxHostedSpaces';

/**
 * v1 policy (goal.md decisions): guests get the least, free accounts get
 * friends and feed customization, paid never hits a limit.
 */
export const DEFAULT_LIMITS_SPEC: LimitsSpec = {
  guest: {
    puzzlesPerDay: 20,
    canHost: true,
    canJoin: true,
    canWatch: true,
    canUseFriends: false,
    canCustomizeFeed: false,
    maxHostedSpaces: null,
  },
  free: {
    puzzlesPerDay: null,
    canHost: true,
    canJoin: true,
    canWatch: true,
    canUseFriends: true,
    canCustomizeFeed: true,
    maxHostedSpaces: 1,
  },
  paid: {
    puzzlesPerDay: null,
    canHost: true,
    canJoin: true,
    canWatch: true,
    canUseFriends: true,
    canCustomizeFeed: true,
    maxHostedSpaces: null,
  },
};

export type LimitVerdict = {
  readonly allowed: boolean;
  readonly limit: number | null;
  readonly remaining: number | null;
};

/**
 * Cheap and pure: no I/O, no clock — the same inputs give the same answer on
 * the client, offline, and during server replay.
 */
export function evaluateLimit(input: {
  readonly tier: Tier;
  readonly spec: LimitsSpec;
  readonly feature: CountedLimitFeature;
  readonly usage: number;
}): LimitVerdict {
  const limit = input.spec[input.tier][input.feature];
  if (limit === null) return { allowed: true, limit: null, remaining: null };
  return {
    allowed: input.usage < limit,
    limit,
    remaining: Math.max(0, limit - input.usage),
  };
}

/** Feature flags are plain booleans on the tier's policy. */
export function isFeatureAllowed(input: {
  readonly tier: Tier;
  readonly spec: LimitsSpec;
  readonly feature: FeatureGate;
}): boolean {
  return input.spec[input.tier][input.feature];
}

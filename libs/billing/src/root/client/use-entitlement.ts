import { useIsSignedIn, useMyId } from '@libs/auth/public/use-current-user';
import { useClientConfig } from '@libs/client-config/public/use-client-config';
import type { MembershipStatus } from '@pkgs/billing';
import { useClock } from '@pkgs/clock/solid';
import {
  type CountedLimitFeature,
  evaluateLimit,
  type FeatureGate,
  isFeatureAllowed,
  type LimitVerdict,
  type MembershipSnapshot,
  resolveTier,
  type Tier,
} from '@pkgs/entitlements';
import { sql } from '@pkgs/sql';
import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';

type MembershipRow = {
  readonly status: string | null;
  readonly current_period_end: string | null;
  readonly cancel_at_period_end: number | boolean | null;
};

const MEMBERSHIP_STATUSES: Readonly<Record<string, MembershipStatus>> = {
  incomplete: 'incomplete',
  trialing: 'trialing',
  active: 'active',
  delinquent: 'delinquent',
  ended: 'ended',
};

/** Unknown statuses resolve to `null` — the tier rule then ignores the row. */
function asMembershipStatus(value: string | null): MembershipStatus | null {
  if (value === null) return null;
  return MEMBERSHIP_STATUSES[value] ?? null;
}

function readMembership(
  row: MembershipRow | undefined
): MembershipSnapshot | null {
  if (row === undefined) return null;
  const status = asMembershipStatus(row.status);
  if (status === null) return null;
  const parsed =
    row.current_period_end === null
      ? Number.NaN
      : Date.parse(row.current_period_end);
  return {
    status,
    currentPeriodEndMs: Number.isFinite(parsed) ? parsed : null,
    cancelAtPeriodEnd:
      row.cancel_at_period_end === true || row.cancel_at_period_end === 1,
  };
}

/**
 * Local, offline-capable tier. Reads the synced membership row plus config —
 * never the network — so the answer matches what the server will say.
 */
export function useTier(): Accessor<Tier> {
  const myId = useMyId();
  const signedIn = useIsSignedIn();
  const clock = useClock();
  const config = useClientConfig();
  const query = createQuery(
    () => sql<MembershipRow>`
    SELECT status, current_period_end, cancel_at_period_end
    FROM billing_subscriptions
    WHERE account_id = ${myId()} AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 1
  `
  );
  return createMemo(() =>
    resolveTier({
      signedIn: signedIn(),
      membership: readMembership(query.rows()[0]),
      nowMs: clock.now(),
      graceMs: config.config().billing_grace_period_ms,
    })
  );
}

/** Evaluates a counted limit against the current tier and usage. */
export function useLimit(
  feature: CountedLimitFeature,
  usage: Accessor<number>
): Accessor<LimitVerdict> {
  const tier = useTier();
  const config = useClientConfig();
  return createMemo(() =>
    evaluateLimit({
      tier: tier(),
      spec: config.config().limits_spec,
      feature,
      usage: usage(),
    })
  );
}

/** Whether the current tier may use a gated feature. */
export function useFeatureGate(feature: FeatureGate): Accessor<boolean> {
  const tier = useTier();
  const config = useClientConfig();
  return createMemo(() =>
    isFeatureAllowed({
      tier: tier(),
      spec: config.config().limits_spec,
      feature,
    })
  );
}

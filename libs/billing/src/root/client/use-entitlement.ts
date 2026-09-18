import { useIsSignedIn, useMyId } from '@libs/auth/public/use-current-user';
import { useClientConfig } from '@libs/client-config/public/use-client-config';
import { useClock } from '@pkgs/clock/solid';
import {
  type CountedLimitFeature,
  evaluateLimit,
  type FeatureGate,
  isFeatureAllowed,
  type LimitVerdict,
  resolveTier,
  type SubscriptionSnapshot,
  type Tier,
} from '@pkgs/entitlements';
import { sql } from '@pkgs/sql';
import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';

type SubscriptionRow = {
  readonly status: string | null;
  readonly current_period_end: string | null;
  readonly cancel_at_period_end: number | boolean | null;
};

function readSubscription(
  row: SubscriptionRow | undefined
): SubscriptionSnapshot | null {
  if (row === undefined || row.status === null || row.status.length === 0) {
    return null;
  }
  const parsed =
    row.current_period_end === null
      ? Number.NaN
      : Date.parse(row.current_period_end);
  return {
    status: row.status,
    currentPeriodEndMs: Number.isFinite(parsed) ? parsed : null,
    cancelAtPeriodEnd:
      row.cancel_at_period_end === true || row.cancel_at_period_end === 1,
  };
}

/**
 * Local, offline-capable tier. Reads the synced subscription row plus config —
 * never the network — so the answer matches what the server will say.
 */
export function useTier(): Accessor<Tier> {
  const myId = useMyId();
  const signedIn = useIsSignedIn();
  const clock = useClock();
  const config = useClientConfig();
  const query = createQuery(
    () => sql<SubscriptionRow>`
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
      subscription: readSubscription(query.rows()[0]),
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

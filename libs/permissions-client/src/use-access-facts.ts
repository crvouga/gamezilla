import { useClientConfig } from '@libs/app-config-client/use-client-config';
import { useIsSignedIn } from '@libs/auth-client/access-facts';
import { useMyId } from '@libs/auth-client/use-current-user';
import type {
  AccessInputs,
  SubscriptionRow,
} from '@libs/permissions-shared/access-facts';
import {
  accessFactsChangeAtMs,
  governingSubscription,
  resolveAccessFacts,
} from '@libs/permissions-shared/access-facts';
import { createTimedValue } from '@pkgs/clock-client/solid';
import type { Facts } from '@pkgs/permissions-shared/facts';
import sql from '@pkgs/sql-root-shared/sql';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

function sameFacts(a: Facts, b: Facts): boolean {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k])
  );
}

/**
 * Local, offline-capable facts for the caller: the local session's sign-in
 * state plus the synced `billing_subscriptions` / `client_config` rows the
 * server replay also reads — never the network — and when the server last
 * confirmed them, so a device offline past grace falls back to free. The
 * facts re-read themselves when grace runs out. The only client code that
 * reads sign-in state or membership, and it is private to this package.
 */
export function useAccessFacts(): Accessor<Facts> {
  const myId = useMyId();
  const { config } = useClientConfig();
  const signedIn = useIsSignedIn();
  const engine = useSyncEngine();
  const confirmedAtMs = createMemo(() => engine.status().lastSyncedAtMs);
  const subscription = createQuery(
    () => sql<SubscriptionRow>`
    SELECT status, current_period_end, cancel_at_period_end
    FROM billing_subscriptions
    WHERE account_id = ${myId()} AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 50
  `
  );
  const inputs = createTimedValue(
    (nowMs): AccessInputs => ({
      signedIn: signedIn(),
      subscription: governingSubscription(subscription.rows()),
      nowMs,
      graceMs: config().billing_grace_period_ms,
      confirmedAtMs: confirmedAtMs(),
      billingEnabled: config().billing_enabled,
    }),
    accessFactsChangeAtMs
  );
  return createMemo(() => resolveAccessFacts(inputs()), undefined, {
    equals: sameFacts,
  });
}

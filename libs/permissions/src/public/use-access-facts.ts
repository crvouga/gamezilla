import { useIsSignedIn, useMyId } from '@libs/auth/public/use-current-user';
import { useClientConfig } from '@libs/client-config/public/use-client-config';
import { useClock } from '@pkgs/clock/solid';
import type { Facts } from '@pkgs/permissions';
import { sql } from '@pkgs/sql';
import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';

import {
  governingSubscription,
  resolveAccessFacts,
  type SubscriptionRow,
} from '../shared/plan';

/**
 * Local, offline-capable facts for the caller: the local session's sign-in
 * state plus the synced `billing_subscriptions` / `client_config` rows the
 * server replay also reads — never the network. The only client code that reads login state or
 * membership for an access decision.
 */
export function useAccessFacts(): Accessor<Facts> {
  const myId = useMyId();
  const clock = useClock();
  const { config } = useClientConfig();
  const signedIn = useIsSignedIn();
  const subscription = createQuery(
    () => sql<SubscriptionRow>`
    SELECT status, current_period_end, cancel_at_period_end
    FROM billing_subscriptions
    WHERE account_id = ${myId()} AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 50
  `
  );
  return createMemo(() => {
    return resolveAccessFacts({
      signedIn: signedIn(),
      subscription: governingSubscription(subscription.rows()),
      nowMs: clock.now(),
      graceMs: config().billing_grace_period_ms,
    });
  });
}

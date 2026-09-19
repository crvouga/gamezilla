import { useIsSignedIn, useMyId } from '@libs/auth/public/use-current-user';
import { useClientConfig } from '@libs/client-config/public/use-client-config';
import { useClock } from '@pkgs/clock/solid';
import { sql } from '@pkgs/sql';
import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';

import type { PlanRole } from './permission-catalog';
import {
  readSubscriptionSnapshot,
  resolvePlanRole,
  type SubscriptionRow,
} from './plan';

/**
 * Local, offline-capable plan role. Reads the synced subscription row plus
 * config — never the network — so the answer matches what the server will say.
 * This is the only place in the app that reads login state and membership tier
 * for an access decision.
 */
export function usePlanRole(): Accessor<PlanRole> {
  const myId = useMyId();
  const signedIn = useIsSignedIn();
  const clock = useClock();
  const { config } = useClientConfig();
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
    resolvePlanRole({
      signedIn: signedIn(),
      subscription: readSubscriptionSnapshot(query.rows()[0]),
      nowMs: clock.now(),
      graceMs: config().billing_grace_period_ms,
    })
  );
}

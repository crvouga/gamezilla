import { useMyId } from '@libs/auth/public/use-current-user';
import { sql } from '@pkgs/sql';
import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';

export type MySubscriptionRow = {
  readonly status: string;
  readonly price_key: string | null;
  readonly trial_end: string | null;
  readonly current_period_end: string | null;
  readonly grace_until: string | null;
  readonly cancel_at_period_end: boolean | number | null;
};

/** Local `billing_subscriptions` row for the signed-in account. */
export function useMySubscription(): Accessor<MySubscriptionRow | null> {
  const accountId = useMyId();
  const query = createQuery(
    () => sql<MySubscriptionRow>`
      SELECT status, price_key, trial_end, current_period_end, grace_until,
        cancel_at_period_end
      FROM billing_subscriptions
      WHERE account_id = ${accountId()} AND deleted_at IS NULL
      LIMIT 1
    `
  );
  return createMemo(() => query.rows()[0] ?? null);
}

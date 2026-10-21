import { useMyId } from '@libs/auth-client/use-current-user';
import { governingRow } from '@libs/billing-shared/governing-row';
import type { MembershipRow } from '@libs/billing-shared/membership-row';
import sql from '@pkgs/sql-root-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

export type MyMembership = {
  /** The governing row, `null` when there is none. */
  readonly row: Accessor<MembershipRow | null>;
  /** True until the local read has answered once. */
  readonly isLoading: Accessor<boolean>;
};

/**
 * The caller's governing membership row from local SQLite — the one granting
 * the most, at whichever provider — offline, and updated as the providers'
 * changes sync in.
 */
export function useMyMembershipRow(): MyMembership {
  const myId = useMyId();
  const query = createQuery(
    () => sql<MembershipRow>`
    SELECT status, price_key, current_period_end, cancel_at_period_end,
      credit_cents
    FROM billing_subscriptions
    WHERE account_id = ${myId()} AND deleted_at IS NULL
    ORDER BY updated_at DESC
    LIMIT 50
  `
  );
  return {
    row: createMemo(() => governingRow(query.rows())),
    isLoading: query.isLoading,
  };
}

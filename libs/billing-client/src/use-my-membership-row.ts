import { useMyId } from '@libs/auth-client/use-current-user';
import { governingRow } from '@libs/billing-shared/governing-row';
import type { MembershipRow } from '@libs/billing-shared/membership-row';
import sql from '@pkgs/sql-root-shared/sql';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

export type MyMembershipRow = {
  /** The governing row, or `null` when there is none (or none known yet). */
  readonly row: Accessor<MembershipRow | null>;
  /**
   * Whether `null` cannot be trusted yet: the device has not read its local
   * rows, or holds none and has never heard back from the server while it
   * could. A screen must not read "no membership" into it then.
   */
  readonly loading: Accessor<boolean>;
};

/**
 * The caller's governing membership row from local SQLite — the one granting
 * the most, at whichever provider — offline, and updated as the providers'
 * changes sync in.
 */
export function useMyMembershipRow(): MyMembershipRow {
  const myId = useMyId();
  const engine = useSyncEngine();
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
  const row = createMemo(() => governingRow(query.rows()));
  const loading = createMemo(() => {
    if (query.isLoading()) return true;
    if (row() !== null) return false;
    const status = engine.status();
    return status.online && !status.hasEverSynced && status.lastError === null;
  });
  return { row, loading };
}

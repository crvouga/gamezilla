import { useMyId } from '@libs/auth-client/use-current-user';
import sql from '@pkgs/sql-root-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

export type AccountPrivacyRow = {
  readonly owner_id: string;
  readonly deletion_at: string | null;
  readonly erase_by: string | null;
  readonly erased_at: string | null;
  readonly export_status: string | null;
  readonly requested_at: string | null;
  readonly ready_at: string | null;
  readonly export_detail: string | null;
  readonly export_summary: string | null;
  readonly legal_purpose: string | null;
  readonly legal_end_condition: string | null;
};

export type AccountPrivacy = {
  /** The caller's privacy row, `null` when there is none. */
  readonly row: Accessor<AccountPrivacyRow | null>;
  /** True until the local read has answered once. */
  readonly isLoading: Accessor<boolean>;
};

export function useAccountPrivacy(): AccountPrivacy {
  const myId = useMyId();
  const query = createQuery(
    () =>
      sql<AccountPrivacyRow>`SELECT * FROM profile_account_privacy WHERE owner_id = ${myId()} AND deleted_at IS NULL`
  );
  return {
    row: createMemo(() => query.rows()[0] ?? null),
    isLoading: query.isLoading,
  };
}

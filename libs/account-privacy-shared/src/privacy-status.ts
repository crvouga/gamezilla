import sql from '@pkgs/sql-shared/sql';
import type { SqlTx } from '@pkgs/sql-client-shared/interface';

/** Operational view of the erasure job, without any retained personal content. */
export async function readPrivacyStatus(
  db: SqlTx,
  accountId: string,
  nowMs: number
) {
  const rows = await db.query(
    sql<{
      deletion_at: string | null;
      erased_at: string | null;
      export_status: string | null;
      ready_at: string | null;
      erase_by: string | null;
    }>`SELECT deletion_at, erased_at, export_status, ready_at, erase_by FROM profile_account_privacy WHERE owner_id = ${accountId}`
  );
  const row = rows[0];
  const deletion =
    row?.deletion_at == null
      ? 'Active'
      : row.erased_at == null
        ? 'Deleting'
        : 'Deleted';
  const expires =
    row?.ready_at != null && nowMs - Date.parse(row.ready_at) >= 7 * 86_400_000;
  return {
    deletion,
    exportStage: expires ? 'Expired' : (row?.export_status ?? 'NoExport'),
    ordinaryDataRetained: deletion !== 'Deleted',
    eraseBy: row?.erase_by ?? null,
  };
}

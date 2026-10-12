import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';

/**
 * Takes one of a person's own notifications out of their inbox. A dismissed
 * notification counts as read; one that is not theirs is left alone.
 */
export async function dismissOwnNotification(
  tx: SqlTx,
  target: { readonly id: string; readonly userId: string },
  nowIso: string
): Promise<void> {
  await tx.run(
    sql<void>`
      UPDATE notifications
         SET dismissed_at = ${nowIso},
             read_at = COALESCE(read_at, ${nowIso}),
             updated_at = ${nowIso}
       WHERE id = ${target.id} AND user_id = ${target.userId}`
  );
}

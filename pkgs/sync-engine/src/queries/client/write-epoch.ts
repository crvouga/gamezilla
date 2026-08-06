import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

function isMissingUploadState(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('no such table') ||
    message.includes('no such column') ||
    message.includes('does not exist')
  );
}

/** Bump and return the monotonic local optimistic write epoch. */
export async function bumpWriteEpoch(tx: SqlClient): Promise<number> {
  try {
    await tx.run(sql`
      UPDATE _upload_state
      SET write_epoch = write_epoch + 1
      WHERE id = ${'singleton'}
    `);
    const rows = await tx.query(sql<{ write_epoch: number }>`
      SELECT write_epoch FROM _upload_state WHERE id = ${'singleton'} LIMIT 1
    `);
    return Number(rows[0]?.write_epoch ?? 0);
  } catch (error) {
    if (isMissingUploadState(error)) return 0;
    throw error;
  }
}

/** Current write epoch (0 when upload state is missing). */
export async function readWriteEpoch(db: SqlClient): Promise<number> {
  try {
    const rows = await db.query(sql<{ write_epoch: number }>`
      SELECT write_epoch FROM _upload_state WHERE id = ${'singleton'} LIMIT 1
    `);
    return Number(rows[0]?.write_epoch ?? 0);
  } catch (error) {
    if (isMissingUploadState(error)) return 0;
    throw error;
  }
}

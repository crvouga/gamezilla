/**
 * When the server last answered this device's queries. A full merge stamps
 * the scope's `last_active_at`; an answer that nothing changed stamps it too
 * (without waking any query), so the stamp survives a restart and says how
 * long the device has gone without confirming what it holds.
 */
import sql from '@pkgs/sql-shared/sql';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';

/** Stamp `scopeHash` as confirmed by the server at `now`. */
export async function stampScopeConfirmed(
  db: Pick<SqlClient, 'run'>,
  scopeHash: string,
  now: Date
): Promise<void> {
  await db.run(sql`
    UPDATE sync_engine_scope_meta
    SET last_active_at = ${now.toISOString()}
    WHERE scope_hash = ${scopeHash}
      AND deleted_at IS NULL
  `);
}

/** The latest confirmation any live scope recorded (epoch ms), or `null`. */
export async function readLastSyncedAtMs(
  db: Pick<SqlClient, 'query'>
): Promise<number | null> {
  const rows = await db.query(sql<{ readonly at: string | null }>`
    SELECT MAX(last_active_at) AS at
    FROM sync_engine_scope_meta
    WHERE deleted_at IS NULL
  `);
  const at = rows[0]?.at ?? null;
  if (at === null) return null;
  const ms = Date.parse(at);
  return Number.isFinite(ms) ? ms : null;
}

import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { isoNow } from '../space-write-helpers';

/** Insert a local open-session row when missing (`id` = space id). */
export async function openSpaceSession(
  db: SqlClient,
  spaceId: string
): Promise<void> {
  if (spaceId.length === 0) return;
  const existing = await db.query(sql<{ readonly id: string }>`
    SELECT id FROM local_space_open_sessions WHERE id = ${spaceId} LIMIT 1
  `);
  if (existing.length > 0) return;
  const now = isoNow();
  const clientId = globalThis.crypto.randomUUID();
  await db.run(sql<void>`
    INSERT INTO local_space_open_sessions (id, opened_at, client_id, join_announced)
    VALUES (${spaceId}, ${now}, ${clientId}, ${0})
  `);
}

/** Delete the local open-session row for this space. */
export async function closeSpaceSession(
  db: SqlClient,
  spaceId: string
): Promise<void> {
  if (spaceId.length === 0) return;
  await db.run(sql<void>`
    DELETE FROM local_space_open_sessions WHERE id = ${spaceId}
  `);
}

/** Drop session rows whose spaces are already ended (orphan cleanup). */
export async function closeEndedSpaceSessions(db: SqlClient): Promise<void> {
  await db.run(sql<void>`
    DELETE FROM local_space_open_sessions
    WHERE id IN (SELECT id FROM spaces WHERE ended_at IS NOT NULL)
  `);
}

/** Persist that join was announced for this open session. */
export async function markSpaceSessionJoinAnnounced(
  db: SqlClient,
  spaceId: string
): Promise<boolean> {
  if (spaceId.length === 0) return false;
  const before = await db.query(sql<{ readonly join_announced: number | null }>`
    SELECT join_announced FROM local_space_open_sessions
    WHERE id = ${spaceId} LIMIT 1
  `);
  const row = before[0];
  if (row === undefined) return false;
  if (row.join_announced === 1) return false;
  await db.run(sql<void>`
    UPDATE local_space_open_sessions
    SET join_announced = ${1}
    WHERE id = ${spaceId}
  `);
  return true;
}

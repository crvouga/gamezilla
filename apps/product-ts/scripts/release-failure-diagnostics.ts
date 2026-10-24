// @io-wall-ok — release runner reads its isolated database before teardown.
import { openPgClient } from '@pkgs/sql-client-postgres-server-ts/connect';
import { PostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import sql from '@pkgs/sql-root-shared-ts/sql';

/** Keep failed pairing evidence in the job log, without retaining a report. */
export async function printReleasePairingEvidence(connectionString: string) {
  const { sqlClient: db } = await openPgClient({
    connectionString,
    dbScope: new PostgresDbScope('public'),
  });
  try {
    const deliveries = await db.query(sql<Record<string, unknown>>`
      SELECT event_id, attempts, available_at, processed_at, last_error, created_at
      FROM outbox_deliveries WHERE consumer_id = 'chess.form-opponent-match'
      ORDER BY created_at DESC LIMIT 50`);
    const searches = await db.query(sql<Record<string, unknown>>`
      SELECT owner_id, standing, search_id, match_id, time_control, updated_at, deleted_at
      FROM chess_opponent_searches ORDER BY updated_at DESC LIMIT 20`);
    const waiting = await db.query(sql<Record<string, unknown>>`
      SELECT w.id, w.owner_id, w.partition_signature, w.data, w.deleted_at,
        o.available, o.current_id
      FROM matchmaking_waiting w JOIN matchmaking_owners o ON o.id = w.owner_id
      ORDER BY w.created_at DESC LIMIT 20`);
    console.error(
      `release pairing evidence: ${JSON.stringify({ deliveries, searches, waiting })}`
    );
  } finally {
    await db.disconnect();
  }
}

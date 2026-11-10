import { onSchedule } from '@libs/synthetic-population-shared-ts/daily-schedule';
import { parsePersona } from '@libs/synthetic-population-shared-ts/persona';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { isoAt, jsonValue } from './records';

/**
 * Who waits for a place, and since when. A Synthetic User on its daily
 * schedule but not online now is kept away from the moment that is first
 * seen; one whose daily schedule is over waits no longer. A freed place
 * goes to the one kept away longest.
 */
export async function sweepKeptAway(tx: SqlTx, nowMs: number): Promise<void> {
  const now = isoAt(nowMs);
  const rows = await tx.query(
    sql<{
      id: string;
      personality: unknown;
      kept_away_since: string | Date | null;
    }>`SELECT id, personality, kept_away_since FROM population_users WHERE paused = ${false} AND deleted_at IS NULL AND (worker_id IS NULL OR lease_until <= ${now}) ORDER BY created_at, id LIMIT 1000`
  );
  for (const row of rows) {
    const persona = parsePersona(jsonValue(row.personality));
    const waiting =
      persona !== null && onSchedule(persona.dailySchedule, nowMs);
    if (waiting && row.kept_away_since === null)
      await tx.run(
        sql`UPDATE population_users SET kept_away_since = ${now} WHERE id = ${row.id}`
      );
    if (!waiting && row.kept_away_since !== null)
      await tx.run(
        sql`UPDATE population_users SET kept_away_since = ${null} WHERE id = ${row.id}`
      );
  }
}

/** A Synthetic User admitted online now no longer waits. */
export async function admitted(tx: SqlTx, userId: string): Promise<void> {
  await tx.run(
    sql`UPDATE population_users SET kept_away_since = ${null} WHERE id = ${userId}`
  );
}

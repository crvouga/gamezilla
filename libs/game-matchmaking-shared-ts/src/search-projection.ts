import { asKeyword } from '@pkgs/keyword-shared-ts/keyword';
import { readCurrent } from '@pkgs/matchmaking-sql-shared-ts/search-read';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql, { join } from '@pkgs/sql-root-shared-ts/sql';
import { OPPONENT_TIME_CONTROL_KEY } from './search-config';

/** Project the accepted pairing from its fact and the searches it names. */
export async function projectFormedOpponentSearches(
  tx: SqlTx,
  args: {
    readonly participantIds: readonly string[];
    readonly matchId: string;
    readonly timeControl: string;
    readonly nowMs: number;
  }
): Promise<void> {
  const iso = new Date(args.nowMs).toISOString();
  await tx.run(sql`INSERT INTO chess_opponent_searches
    (id, owner_id, search_id, standing, match_id, joined_at_ms, observed_at_ms, formulas, time_control, created_at, updated_at, deleted_at)
    SELECT w.owner_id, w.owner_id, w.id, ${'matched'}, ${args.matchId}, w.joined_at,
      w.ended_at, w.formulas, ${args.timeControl}, ${iso}, ${iso}, ${null}
    FROM matchmaking_waiting w JOIN matchmaking_owners o ON o.id = w.owner_id AND o.current_id = w.id
    WHERE w.id IN (${join(args.participantIds)})
    ON CONFLICT (id) DO UPDATE SET search_id = excluded.search_id, standing = excluded.standing,
      match_id = excluded.match_id, joined_at_ms = excluded.joined_at_ms,
      observed_at_ms = excluded.observed_at_ms, formulas = excluded.formulas,
      time_control = excluded.time_control, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`);
}

export async function projectOpponentSearch(
  tx: SqlTx,
  ownerId: string,
  nowMs: number
): Promise<void> {
  const search = await readCurrent(tx, ownerId, nowMs);
  if (search === null) return;
  const standing = search.result?.status ?? 'ended';
  const matchId =
    search.result?.status === 'matched' ? search.result.matchId : null;
  const control = search.result?.data[asKeyword(OPPONENT_TIME_CONTROL_KEY)];
  const timeControl = typeof control === 'string' ? control : null;
  const iso = new Date(nowMs).toISOString();
  await tx.run(sql`INSERT INTO chess_opponent_searches
    (id, owner_id, search_id, standing, match_id, joined_at_ms, observed_at_ms, formulas, time_control, created_at, updated_at, deleted_at)
    VALUES (${ownerId}, ${ownerId}, ${search.participantId}, ${standing}, ${matchId},
      ${search.joinedAtMs}, ${search.observedAtMs}, ${JSON.stringify(search.formulas)}, ${timeControl}, ${iso}, ${iso}, ${null})
    ON CONFLICT (id) DO UPDATE SET search_id = excluded.search_id, standing = excluded.standing,
      match_id = excluded.match_id, joined_at_ms = excluded.joined_at_ms,
      observed_at_ms = excluded.observed_at_ms, formulas = excluded.formulas,
      time_control = COALESCE(excluded.time_control, chess_opponent_searches.time_control),
      updated_at = excluded.updated_at, deleted_at = excluded.deleted_at`);
}

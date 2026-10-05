import { asKeyword } from '@pkgs/keyword-shared/keyword';
import { readCurrent } from '@pkgs/matchmaking-sql-shared/search-read';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import { CHESS_TIME_CONTROL_KEY } from './search-config';

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
  const control = search.result?.data[asKeyword(CHESS_TIME_CONTROL_KEY)];
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

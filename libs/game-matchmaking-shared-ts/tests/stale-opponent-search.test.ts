import { expect, test } from 'bun:test';
import { opponentSearches } from '@libs/game-matchmaking-shared-ts/multiplayer-tables';
import { stopFindingOpponentMutation } from '@libs/game-matchmaking-shared-ts/stop-finding-opponent-mutation';
import { CASE_NOW_MS } from '@libs/permissions-shared-ts/people';
import {
  mutationEnvFor,
  openConformanceDb,
} from '@libs/permissions-shared-ts/world';
import {
  matchmakingMatched,
  matchmakingOwners,
  matchmakingRequests,
  matchmakingWaiting,
} from '@pkgs/matchmaking-sql-shared-ts/tables';
import sql from '@pkgs/sql-root-shared-ts/sql';

// regression: stale-opponent-search-cannot-stop
test('Stop clears an orphaned waiting search and preserves a newer search', async () => {
  const db = await openConformanceDb([
    opponentSearches,
    matchmakingMatched,
    matchmakingOwners,
    matchmakingRequests,
    matchmakingWaiting,
  ]);
  const env = mutationEnvFor('guest', CASE_NOW_MS);
  const stop = (searchId: string) =>
    db.transaction((tx) =>
      stopFindingOpponentMutation.run(
        { tx, env },
        { searchId, requestId: searchId }
      )
    );
  try {
    await db.run(sql`INSERT INTO chess_opponent_searches
      (id, owner_id, search_id, standing, time_control, joined_at_ms)
      VALUES (${env.actorId}, ${env.actorId}, 'old', 'waiting', 'connect-four/10+5', ${CASE_NOW_MS - 3244197 * 1000})`);
    await expect(stop('other')).rejects.toThrow('no opponent search');
    await stop('old');
    expect(
      await db.query(
        sql<{
          standing: string;
        }>`SELECT standing FROM chess_opponent_searches WHERE owner_id = ${env.actorId}`
      )
    ).toEqual([{ standing: 'ended' }]);
  } finally {
    await db.disconnect();
  }
});

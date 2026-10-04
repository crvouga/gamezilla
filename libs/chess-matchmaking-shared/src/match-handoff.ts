import { opponentRestrictions } from '@libs/friends-shared/opponent-restrictions';
import { assert } from '@pkgs/assert-shared/singleton';
import type { MatchFormation } from '@pkgs/matchmaking-sql-shared/match-pass';
import { formMatches } from '@pkgs/matchmaking-sql-shared/match-pass';
import { changeAvailability } from '@pkgs/matchmaking-sql-shared/owner-repository';
import type { SqlTx } from '@pkgs/sql-client-shared/interface';
import sql from '@pkgs/sql-shared/sql';
import { Chess } from 'chess.js';
import { MultiplayerGameRepository } from './game-repository';
import { CHESS_OPPONENT_POOL, CHESS_SEARCH_RADIUS } from './search-config';
import { projectOpponentSearch } from './search-projection';

/** Invoked inside the reusable package's formation transaction. */
export async function acceptChessMatch(
  tx: SqlTx,
  fact: MatchFormation,
  nowMs: number
): Promise<void> {
  assert.ok(fact.participants.length === 2, 'a chess match has two people');
  const white = fact.participants[0]!;
  const black = fact.participants[1]!;
  const prior = await tx.query(
    sql<{
      id: string;
    }>`SELECT id FROM chess_multiplayer_games WHERE match_id = ${fact.matchId}`
  );
  if (prior.length > 0) return;
  const games = new MultiplayerGameRepository(tx);
  for (const person of fact.participants)
    assert.ok(
      (await games.unfinishedCount(person.ownerId)) === 0,
      'an unfinished game makes its person unavailable'
    );
  const iso = new Date(nowMs).toISOString();
  await tx.run(sql`INSERT INTO chess_multiplayer_games
    (id, match_id, white_id, black_id, fen, pgn, revision, turn, outcome, reason, created_at, updated_at, deleted_at)
    VALUES (${fact.matchId}, ${fact.matchId}, ${white.ownerId}, ${black.ownerId}, ${new Chess().fen()},
      ${''}, ${0}, ${white.ownerId}, ${'ongoing'}, ${null}, ${iso}, ${iso}, ${null})`);
  for (const person of fact.participants) {
    await tx.run(sql`INSERT INTO chess_multiplayer_players (id, owner_id, game_id, created_at, updated_at, deleted_at)
      VALUES (${person.ownerId}, ${person.ownerId}, ${fact.matchId}, ${iso}, ${iso}, ${null})
      ON CONFLICT (id) DO UPDATE SET game_id = excluded.game_id, updated_at = excluded.updated_at`);
    await changeAvailability(tx, {
      ownerId: person.ownerId,
      available: false,
      nowMs,
    });
    await projectOpponentSearch(tx, person.ownerId, nowMs);
  }
}

export function formChessMatches(
  tx: SqlTx,
  ports: { readonly nowMs: number; readonly createId: () => string }
): Promise<readonly string[]> {
  const owners: string[] = [];
  return formMatches(tx, {
    ...ports,
    partitionSignature: CHESS_OPPONENT_POOL,
    groupSize: 2,
    maxPairsPerPass: 500,
    radius: CHESS_SEARCH_RADIUS,
    restrictionsFor: opponentRestrictions,
    onFormed: async (transaction, fact) => {
      await acceptChessMatch(transaction, fact, ports.nowMs);
      owners.push(...fact.participants.map((person) => person.ownerId));
    },
  }).then(() => owners);
}

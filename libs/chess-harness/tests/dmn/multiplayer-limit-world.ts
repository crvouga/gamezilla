import { BILLING_TABLES } from '@libs/billing-shared/tables';
import { CHESS_TABLES } from '@libs/chess-feature-shared/chess-tables';
import { countInput } from '@libs/permissions-shared/people';
import type { ServerCase } from '@libs/permissions-shared/server';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { matchmakingSchema } from '@pkgs/matchmaking-sql-shared/tables';
import { outboxSchema } from '@pkgs/outbox-shared/tables';
import sql from '@pkgs/sql-shared/sql';

export const MULTIPLAYER_LIMIT_TABLES = [...BILLING_TABLES, ...CHESS_TABLES];
export const UNFINISHED_INPUT = 'unfinished multiplayer games';

/** Earlier accepted games, including the numeric refusal boundary. */
export async function seedUnfinishedGames(c: ServerCase) {
  await reconcileSqliteSchema(c.db, matchmakingSchema, {
    ownership: 'declared-only',
  });
  await reconcileSqliteSchema(c.db, outboxSchema, {
    ownership: 'declared-only',
  });
  const stamp = c.env.now().toISOString();
  for (let n = 0; n < countInput(c.input, UNFINISHED_INPUT); n++)
    await c.db.run(sql`INSERT INTO chess_multiplayer_games
      (id, match_id, white_id, black_id, fen, pgn, revision, turn, outcome, reason, created_at, updated_at, deleted_at)
      VALUES (${`earlier-${n}`}, ${`match-${n}`}, ${c.env.actorId}, ${`opponent-${n}`},
        ${'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}, ${''}, ${0}, ${c.env.actorId},
        ${'ongoing'}, ${null}, ${stamp}, ${stamp}, ${null})`);
}

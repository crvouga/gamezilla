import { BILLING_TABLES } from '@libs/billing-shared/tables';
import {
  BOT_CUSTOM_GAME_SIDE,
  CustomGamesAttr,
  newCustomGame,
} from '@libs/chess-custom-game-shared/custom-game-state';
import { CHESS_TABLES } from '@libs/chess-sub-shared/chess-tables';
import { countInput } from '@libs/permissions-shared/people';
import type { ServerCase } from '@libs/permissions-shared/server';
import { SPACES_TABLES } from '@libs/spaces-shared/tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { matchmakingSchema } from '@pkgs/matchmaking-sql-shared/tables';
import { outboxSchema } from '@pkgs/outbox-shared/tables';
import sql from '@pkgs/sql-root-shared/sql';

export const MULTIPLAYER_LIMIT_TABLES = [
  ...BILLING_TABLES,
  ...CHESS_TABLES,
  ...SPACES_TABLES,
];
export const UNFINISHED_INPUT = 'unfinished multiplayer games';
export const CUSTOM_GAME_INPUT = 'active Custom Games as a participant';

const CUSTOM_GAME_SPACE = 'custom-game-space-of-';

/**
 * The space rooms the server reads: a Custom Game space a case seeded holds
 * an active game with its host as White against a bot, every other room none.
 */
export const LIMIT_ROOMS = {
  read: async (topic: string) => {
    const host = topic.split(`space:${CUSTOM_GAME_SPACE}`)[1];
    if (host === undefined) return {};
    return CustomGamesAttr({
      current: {
        ...newCustomGame(`custom-game-of-${host}`, host),
        status: 'active',
        white: { kind: 'person', person: host },
        black: BOT_CUSTOM_GAME_SIDE,
      },
      history: [],
    });
  },
};

/** Earlier accepted games, including the numeric refusal boundary. */
export async function seedUnfinishedGames(c: ServerCase) {
  await reconcileSqliteSchema(c.db, matchmakingSchema, {
    ownership: 'declared-only',
  });
  await reconcileSqliteSchema(c.db, outboxSchema, {
    ownership: 'declared-only',
  });
  await c.db.run(sql`INSERT INTO spaces (id, host_id, host_member_id, host_account_id, ended_at, deleted_at)
    VALUES (${'multiplayer-limit-space'}, ${c.env.deviceId}, ${c.env.actorId}, ${c.env.accountId}, ${null}, ${null})`);
  for (let n = 0; n < countInput(c.input, CUSTOM_GAME_INPUT); n++)
    await c.db.run(sql`INSERT INTO spaces (id, host_id, host_member_id, host_account_id, ended_at, deleted_at)
      VALUES (${`${CUSTOM_GAME_SPACE}${c.env.actorId}`}, ${c.env.deviceId}, ${c.env.actorId}, ${c.env.accountId}, ${null}, ${null})`);
  const stamp = c.env.now().toISOString();
  for (let n = 0; n < countInput(c.input, UNFINISHED_INPUT); n++)
    await c.db.run(sql`INSERT INTO chess_multiplayer_games
      (id, match_id, white_id, black_id, fen, pgn, revision, turn, outcome, reason, created_at, updated_at, deleted_at)
      VALUES (${`earlier-${n}`}, ${`match-${n}`}, ${c.env.actorId}, ${`opponent-${n}`},
        ${'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'}, ${''}, ${0}, ${c.env.actorId},
        ${'ongoing'}, ${null}, ${stamp}, ${stamp}, ${null})`);
}

/**
 * The stored worlds of the unfinished-matched-game table, for one game at a
 * time: the account's earlier matched games of that game and the custom
 * game under way its space room holds.
 */

import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import { MULTIPLAYER_TABLES } from '@libs/game-matchmaking-shared-ts/multiplayer-tables';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import {
  BOT_CUSTOM_GAME_SIDE,
  CustomGamesAttr,
  newCustomGame,
} from '@libs/game-session-shared-ts/custom-game-state';
import { countInput } from '@libs/permissions-shared-ts/people';
import type { ServerCase } from '@libs/permissions-shared-ts/server';
import { SPACES_TABLES } from '@libs/spaces-shared-ts/tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { matchmakingSchema } from '@pkgs/matchmaking-sql-shared-ts/tables';
import { outboxSchema } from '@pkgs/outbox-shared-ts/tables';
import sql from '@pkgs/sql-root-shared-ts/sql';

export const MULTIPLAYER_LIMIT_TABLES = [
  ...BILLING_TABLES,
  ...MULTIPLAYER_TABLES,
  ...SPACES_TABLES,
];
export const UNFINISHED_INPUT = 'unfinished matched games';
export const CUSTOM_GAME_INPUT = 'custom games under way as a participant';
/** The space the account seeks an opponent from. */
export const LIMIT_SPACE = 'multiplayer-limit-space';

const CUSTOM_GAME_SPACE = 'custom-game-space-of-';

/**
 * The space rooms the server reads: a custom-game space a case seeded holds
 * a custom game of `game` under way, its host on the first side against a
 * bot; every other room none.
 */
export function limitRooms(game: HarnessGame) {
  return {
    read: async (topic: string) => {
      const host = topic.split(`space:${CUSTOM_GAME_SPACE}`)[1];
      if (host === undefined) return {};
      return CustomGamesAttr({
        current: {
          ...newCustomGame(
            `custom-game-of-${host}`,
            host,
            game.shared.turnGame.rules.initial()
          ),
          status: 'active',
          white: { kind: 'person', person: host },
          black: BOT_CUSTOM_GAME_SIDE,
        },
        history: [],
      });
    },
  };
}

/** Earlier accepted matched games of `game`, including the numeric refusal boundary. */
export function seedUnfinishedGames(game: HarnessGame) {
  return async (c: ServerCase) => {
    await reconcileSqliteSchema(c.db, matchmakingSchema, {
      ownership: 'declared-only',
    });
    await reconcileSqliteSchema(c.db, outboxSchema, {
      ownership: 'declared-only',
    });
    await c.db.run(sql`INSERT INTO spaces (id, host_id, host_member_id, host_account_id, ended_at, deleted_at)
      VALUES (${LIMIT_SPACE}, ${c.env.deviceId}, ${c.env.actorId}, ${c.env.accountId}, ${null}, ${null})`);
    for (let n = 0; n < countInput(c.input, CUSTOM_GAME_INPUT); n++)
      await c.db.run(sql`INSERT INTO spaces (id, host_id, host_member_id, host_account_id, ended_at, deleted_at)
        VALUES (${`${CUSTOM_GAME_SPACE}${c.env.actorId}`}, ${c.env.deviceId}, ${c.env.actorId}, ${c.env.accountId}, ${null}, ${null})`);
    const stamp = c.env.now().toISOString();
    for (let n = 0; n < countInput(c.input, UNFINISHED_INPUT); n++)
      await c.db.run(sql`INSERT INTO chess_multiplayer_games
        (id, match_id, white_id, black_id, fen, pgn, revision, turn, outcome, reason, created_at, updated_at, deleted_at)
        VALUES (${`earlier-${n}`}, ${`match-${n}`}, ${c.env.actorId}, ${`opponent-${n}`},
          ${game.shared.turnGame.rules.initial()}, ${''}, ${0}, ${c.env.actorId},
          ${'ongoing'}, ${null}, ${stamp}, ${stamp}, ${null})`);
  };
}

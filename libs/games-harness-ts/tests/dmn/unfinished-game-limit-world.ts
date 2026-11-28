/**
 * The stored worlds of the unfinished-matched-game table, for one game at a
 * time: the account's earlier matched games of that game and the custom
 * game under way its space room holds.
 */

import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import { MULTIPLAYER_TABLES } from '@libs/game-matchmaking-shared-ts/multiplayer-tables';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import {
  BOT_GAME_SESSION_SIDE,
  GameSessionsAttr,
  newGameSession,
} from '@libs/game-session-shared-ts/game-session-state';
import { countInput } from '@libs/permissions-shared-ts/people';
import type { ServerCase } from '@libs/permissions-shared-ts/server';
import { PROFILE_TABLES } from '@libs/profile-shared-ts/tables';
import { SPACES_TABLES } from '@libs/spaces-shared-ts/tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { matchmakingSchema } from '@pkgs/matchmaking-sql-shared-ts/tables';
import { outboxSchema } from '@pkgs/outbox-shared-ts/tables';
import sql from '@pkgs/sql-root-shared-ts/sql';

export const MULTIPLAYER_LIMIT_TABLES = [
  ...BILLING_TABLES,
  ...MULTIPLAYER_TABLES,
  // regression: unfinished-game-limit-no-profile-table
  // A search reads the searcher's account kind (a Synthetic User searches at
  // the waiting person's rating).
  ...PROFILE_TABLES,
  ...SPACES_TABLES,
];
export const UNFINISHED_INPUT = 'unfinished matched games';
export const GAME_SESSION_INPUT = 'game sessions under way as a participant';
/** The space the account seeks an opponent from. */
export const LIMIT_SPACE = 'multiplayer-limit-space';

const GAME_SESSION_SPACE = 'game-session-space-of-';

/**
 * The space rooms the server reads: a game-session space a case seeded holds
 * a game session of `game` under way, its host on the first side against a
 * bot; every other room none.
 */
export function limitRooms(game: HarnessGame) {
  return {
    read: async (topic: string) => {
      const host = topic.split(`space:${GAME_SESSION_SPACE}`)[1];
      if (host === undefined) return {};
      return GameSessionsAttr({
        current: {
          ...newGameSession({
            id: `game-session-of-${host}`,
            creator: host,
            position: game.shared.registration.rules.initial(),
          }),
          status: 'active',
          white: { kind: 'person', person: host },
          black: BOT_GAME_SESSION_SIDE,
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
    for (let n = 0; n < countInput(c.input, GAME_SESSION_INPUT); n++)
      await c.db.run(sql`INSERT INTO spaces (id, host_id, host_member_id, host_account_id, ended_at, deleted_at)
        VALUES (${`${GAME_SESSION_SPACE}${c.env.actorId}`}, ${c.env.deviceId}, ${c.env.actorId}, ${c.env.accountId}, ${null}, ${null})`);
    const stamp = c.env.now().toISOString();
    for (let n = 0; n < countInput(c.input, UNFINISHED_INPUT); n++)
      await c.db.run(sql`INSERT INTO chess_multiplayer_games
        (id, match_id, white_id, black_id, fen, pgn, revision, turn, outcome, reason, created_at, updated_at, deleted_at)
        VALUES (${`earlier-${n}`}, ${`match-${n}`}, ${c.env.actorId}, ${`opponent-${n}`},
          ${game.shared.registration.rules.initial()}, ${''}, ${0}, ${c.env.actorId},
          ${'ongoing'}, ${null}, ${stamp}, ${stamp}, ${null})`);
  };
}

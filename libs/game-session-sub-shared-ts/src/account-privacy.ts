import {
  eraseMultiplayer,
  withdrawMultiplayer,
} from '@libs/game-matchmaking-shared-ts/account-privacy';
import type { AccountPrivacyContribution } from '@libs/sub-shared-ts/account-privacy';
import sql, { raw } from '@pkgs/sql-root-shared-ts/sql';
import { snapshotGameSessions } from './game-session-export';

const PERSONAL_TABLES = [
  'chess_multiplayer_players',
  'chess_opponent_searches',
  'chess_multiplayer_commands',
  'chess_multiplayer_ratings',
  'chess_multiplayer_setups',
  'chess_multiplayer_hands',
  'chess_custom_game_seats',
] as const;
export const GAME_SESSION_PRIVACY: AccountPrivacyContribution = {
  name: 'game history and preferences',
  snapshot: async (ctx, rooms) => {
    const rows: Record<string, unknown> = {};
    for (const table of PERSONAL_TABLES)
      rows[table] = await ctx.tx.query(
        sql<
          Record<string, unknown>
        >`SELECT * FROM ${raw(table)} WHERE owner_id = ${ctx.env.actorId}`
      );
    rows['chess_multiplayer_games'] = await ctx.tx.query(
      sql<
        Record<string, unknown>
      >`SELECT * FROM chess_multiplayer_games WHERE white_id = ${ctx.env.actorId} OR black_id = ${ctx.env.actorId} OR red_id = ${ctx.env.actorId} OR blue_id = ${ctx.env.actorId}`
    );
    rows['gameSessions'] = await snapshotGameSessions(ctx, rooms);
    return rows;
  },
  withdraw: withdrawMultiplayer,
  erase: async (ctx) => {
    await eraseMultiplayer(ctx);
    // Where the person sat stays with nobody once the account is gone.
    await ctx.tx.run(sql`UPDATE chess_custom_game_seats
      SET deleted_at = ${ctx.env.now().toISOString()}
      WHERE owner_id = ${ctx.env.actorId} AND deleted_at IS NULL`);
  },
};

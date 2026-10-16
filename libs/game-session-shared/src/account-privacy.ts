import {
  eraseMultiplayer,
  withdrawMultiplayer,
} from '@libs/game-matchmaking-shared/account-privacy';
import type { AccountPrivacyContribution } from '@libs/sub-shared/account-privacy';
import sql, { raw } from '@pkgs/sql-root-shared/sql';
import { snapshotCustomGames } from './custom-game-export';

const PERSONAL_TABLES = [
  'chess_multiplayer_players',
  'chess_opponent_searches',
  'chess_multiplayer_commands',
  'chess_multiplayer_ratings',
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
      >`SELECT * FROM chess_multiplayer_games WHERE white_id = ${ctx.env.actorId} OR black_id = ${ctx.env.actorId}`
    );
    rows['customGames'] = await snapshotCustomGames(ctx, rooms);
    return rows;
  },
  withdraw: withdrawMultiplayer,
  erase: eraseMultiplayer,
};

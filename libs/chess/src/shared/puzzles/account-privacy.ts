import type { AccountPrivacyContribution } from '@libs/feature/public/account-privacy';
import { raw, sql } from '@pkgs/sql';
import {
  eraseMultiplayer,
  withdrawMultiplayer,
} from '../multiplayer/account-privacy';

const PERSONAL_TABLES = [
  'chess_multiplayer_players',
  'chess_opponent_searches',
  'chess_multiplayer_commands',
  'chess_puzzle_profiles',
  'chess_puzzle_interactions',
  'chess_puzzle_rating_events',
  'chess_puzzle_feed_settings',
] as const;

export const CHESS_PRIVACY: AccountPrivacyContribution = {
  name: 'chess games, puzzle progress and preferences',
  snapshot: async ({ tx, env }) => {
    const rows: Record<string, unknown> = {};
    for (const table of PERSONAL_TABLES)
      rows[table] = await tx.query(
        sql<
          Record<string, unknown>
        >`SELECT * FROM ${raw(table)} WHERE owner_id = ${env.actorId}`
      );
    rows['chess_multiplayer_games'] = await tx.query(sql<
      Record<string, unknown>
    >`SELECT * FROM chess_multiplayer_games
      WHERE white_id = ${env.actorId} OR black_id = ${env.actorId}`);
    return rows;
  },
  withdraw: async ({ tx, env }) => {
    await withdrawMultiplayer({ tx, env });
    for (const table of PERSONAL_TABLES)
      await tx.run(
        sql`UPDATE ${raw(table)} SET deleted_at = ${(env.serverNow ?? env.now)().toISOString()} WHERE owner_id = ${env.actorId}`
      );
  },
  erase: async ({ tx, env }) => {
    await eraseMultiplayer({ tx, env });
    await tx.run(
      sql`UPDATE chess_puzzle_interactions SET owner_id = ${null}, uci = ${null}, kind = ${null}, puzzle_id = ${null}, puzzle_rating = ${null}, solve_idx = ${null}, correct = ${null}, at = ${null} WHERE owner_id = ${env.actorId}`
    );
    await tx.run(
      sql`UPDATE chess_puzzle_rating_events SET owner_id = ${null}, puzzle_id = ${null}, puzzle_rating = ${null}, outcome = ${null}, score_permille = ${null}, rating_before = ${null}, rating_after = ${null}, rating_deviation_before = ${null}, rating_deviation_after = ${null}, volatility_micros_after = ${null}, at = ${null} WHERE owner_id = ${env.actorId}`
    );
    await tx.run(
      sql`UPDATE chess_puzzle_profiles SET owner_id = ${null}, rating = ${null}, rating_deviation = ${null}, volatility_micros = ${null}, last_interaction_at = ${null} WHERE owner_id = ${env.actorId}`
    );
    await tx.run(
      sql`UPDATE chess_puzzle_feed_settings SET owner_id = ${null}, config = ${null} WHERE owner_id = ${env.actorId}`
    );
  },
};

import type { AccountPrivacyContribution } from '@libs/sub-shared-ts/account-privacy';
import sql, { raw } from '@pkgs/sql-root-shared-ts/sql';
import { CONTENT_TABLES } from './content-tables';

const PERSONAL_TABLES = [
  ...CONTENT_TABLES.map((table) => table.name),
  'chess_puzzle_profiles',
  'chess_puzzle_interactions',
  'chess_puzzle_rating_events',
  'chess_puzzle_feed_settings',
] as const;

export const PUZZLE_PRIVACY: AccountPrivacyContribution = {
  name: 'puzzle progress and preferences',
  snapshot: async (ctx) => {
    const { tx, env } = ctx;
    const rows: Record<string, unknown> = {};
    for (const table of PERSONAL_TABLES)
      rows[table] = await tx.query(
        sql<
          Record<string, unknown>
        >`SELECT * FROM ${raw(table)} WHERE owner_id = ${env.actorId}`
      );
    return rows;
  },
  withdraw: async ({ tx, env }) => {
    for (const table of PERSONAL_TABLES)
      await tx.run(
        sql`UPDATE ${raw(table)} SET deleted_at = ${(env.serverNow ?? env.now)().toISOString()} WHERE owner_id = ${env.actorId}`
      );
  },
  erase: async ({ tx, env }) => {
    await tx.run(sql`
      UPDATE puzzle_content_attempts SET owner_id = ${null}, puzzle_id = ${null}, source_id = ${null}, game_id = ${null}, pack_revision_id = ${null}, current_position_id = ${null}, activity_order = ${null}
      WHERE owner_id = ${env.actorId}
    `);
    await tx.run(sql`
      UPDATE puzzle_content_positions SET owner_id = ${null}, attempt_id = ${null}, parent_id = ${null}, history = ${null}
      WHERE owner_id = ${env.actorId}
    `);
    await tx.run(sql`
      UPDATE puzzle_content_completions SET owner_id = ${null}, puzzle_id = ${null}, puzzle_revision_id = ${null}, attempt_id = ${null}, position_id = ${null}, statistics = ${null}
      WHERE owner_id = ${env.actorId}
    `);
    await tx.run(sql`
      UPDATE puzzle_content_documents SET owner_id = ${null}, status = ${'withdrawn'}
      WHERE owner_id = ${env.actorId}
    `);
    await tx.run(sql`
      UPDATE puzzle_content_publications SET owner_id = ${null}, status = ${'withdrawn'}
      WHERE owner_id = ${env.actorId}
    `);
    await tx.run(sql`
      UPDATE puzzle_content_drafts
      SET owner_id = ${null}, title = ${null}, description = ${null}, difficulty = ${null},
          definition = ${null}, validation_solution = ${null}, validation_issues = ${'[]'}, validation_status = ${'invalid'}
      WHERE owner_id = ${env.actorId}
    `);
    await tx.run(sql`
      UPDATE puzzle_content_revisions
      SET owner_id = ${null}, title = ${null}, description = ${null}, difficulty = ${null}, definition = ${null}
      WHERE owner_id = ${env.actorId}
    `);
    await tx.run(
      sql`UPDATE puzzle_content_pack_items SET owner_id = ${null} WHERE owner_id = ${env.actorId}`
    );
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

import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { queryRequires } from '@libs/permissions-shared-ts/query-permission';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';

export const puzzleContentAttemptsOwned = defineQuery({
  name: 'puzzleContentAttemptsOwned',
  authorize: queryRequires(PERMISSION.puzzlesPlay),
  async run(ctx) {
    const actor = ctx.env.actorId;
    return {
      puzzle_content_attempts: await ctx.db.query(
        sql`SELECT * FROM puzzle_content_attempts WHERE owner_id = ${actor}`
      ),
      puzzle_content_positions: await ctx.db.query(
        sql`SELECT * FROM puzzle_content_positions WHERE owner_id = ${actor}`
      ),
      puzzle_content_completions: await ctx.db.query(
        sql`SELECT * FROM puzzle_content_completions WHERE owner_id = ${actor}`
      ),
    };
  },
});

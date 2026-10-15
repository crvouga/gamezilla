import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { queryRequires } from '@libs/permissions-shared/query-permission';
import sql from '@pkgs/sql-root-shared/sql';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';

export const chessPuzzleImport = defineQuery({
  name: 'chessPuzzleImport',
  entryChannel: (_params, ctx) => [`user:${ctx.actorId}`],
  authorize: queryRequires(PERMISSION.puzzlesManage),
  async run(ctx) {
    return {
      chess_puzzle_load: await ctx.db.query(
        sql`SELECT * FROM chess_puzzle_load WHERE id = 'dataset'`
      ),
    };
  },
});

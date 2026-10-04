import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { queryRequires } from '@libs/permissions-shared/query-permission';
import sql from '@pkgs/sql-shared/sql';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';
import { z } from 'zod';

export const chessMultiplayerGame = defineQuery({
  name: 'chessMultiplayerGame',
  params: z.object({ gameId: z.string().min(1) }),
  sampleParams: { gameId: 'private-game' },
  authorize: queryRequires(PERMISSION.chessMultiplayerPlay),
  async run(ctx, params) {
    return {
      chess_multiplayer_games:
        await ctx.db.query(sql`SELECT * FROM chess_multiplayer_games
      WHERE id = ${params.gameId} AND (white_id = ${ctx.env.actorId} OR black_id = ${ctx.env.actorId})`),
    };
  },
});

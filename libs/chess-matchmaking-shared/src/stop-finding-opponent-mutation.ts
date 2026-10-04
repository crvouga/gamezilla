import { requireInMutation } from '@libs/permissions-shared/mutation-permission';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { SearchCommands } from '@pkgs/matchmaking-sql-shared/search-commands';
import sql from '@pkgs/sql-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { z } from 'zod';
import { CHESS_SEARCH_SCHEMA } from './search-config';
import { projectOpponentSearch } from './search-projection';

export const stopFindingChessOpponentMutation = defineMutation({
  name: 'stopFindingChessOpponent',
  requiresOnline: true,
  pendingUx: 'pending',
  args: z.object({ requestId: z.string().min(1), searchId: z.string().min(1) }),
  async run(ctx, args) {
    await requireInMutation(ctx, PERMISSION.matchmakingStop);
    if (ctx.env.serverNow === undefined) {
      const waits = await ctx.tx.query(sql<{
        id: string;
      }>`SELECT id FROM chess_opponent_searches
        WHERE owner_id = ${ctx.env.actorId} AND search_id = ${args.searchId} AND standing = 'waiting' AND deleted_at IS NULL`);
      if (waits.length === 0)
        throw new MutationError(
          'CHESS_NO_SEARCH',
          'You have no opponent search to stop.'
        );
      return;
    }
    const now = () => ctx.env.serverNow!().getTime();
    const result = await new SearchCommands(ctx.tx, {
      now,
      schema: CHESS_SEARCH_SCHEMA,
    }).stop({
      ownerId: ctx.env.actorId,
      requestId: args.requestId,
      participantId: args.searchId,
    });
    if (!result.removed)
      throw new MutationError(
        'CHESS_NO_SEARCH',
        'You have no opponent search to stop.'
      );
    await projectOpponentSearch(ctx.tx, ctx.env.actorId, now());
  },
});

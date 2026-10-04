import {
  requireInMutation,
  requireLimitInMutation,
} from '@libs/permissions/public/mutation-permission';
import { LIMIT, PERMISSION } from '@libs/permissions/public/permission-catalog';
import { asKeywordRecord } from '@pkgs/keyword';
import { SearchCommands } from '@pkgs/matchmaking-sql';
import { Outbox } from '@pkgs/outbox';
import { defineMutation, MutationError } from '@pkgs/sync-engine/shared';
import { z } from 'zod';
import { MultiplayerGameRepository } from '../../../shared/multiplayer/game-repository';
import { OpponentRequested } from '../../../shared/multiplayer/opponent-requested';
import {
  CHESS_OPPONENT_POOL,
  CHESS_SEARCH_FORMULAS,
  CHESS_SEARCH_SCHEMA,
} from '../../../shared/multiplayer/search-config';
import { projectOpponentSearch } from '../../../shared/multiplayer/search-projection';

export const findChessOpponentMutation = defineMutation({
  name: 'findChessOpponent',
  requiresOnline: true,
  pendingUx: 'pending',
  args: z.object({ requestId: z.string().min(1) }),
  async run(ctx, args) {
    await requireInMutation(ctx, PERMISSION.matchmakingUse);
    const checkLimit = async () =>
      requireLimitInMutation(
        ctx,
        LIMIT.unfinishedMultiplayerGames,
        await new MultiplayerGameRepository(ctx.tx).unfinishedCount(
          ctx.env.actorId
        )
      );
    const serverNow = ctx.env.serverNow;
    if (serverNow === undefined) {
      await checkLimit();
      return;
    }
    const now = () => serverNow().getTime();
    const result = await new SearchCommands(ctx.tx, {
      now,
      schema: CHESS_SEARCH_SCHEMA,
      authorizeBegin: checkLimit,
    }).begin({
      ownerId: ctx.env.actorId,
      requestId: args.requestId,
      data: asKeywordRecord(
        { 'matchmaking/pool': CHESS_OPPONENT_POOL, 'player/rating': 1500 },
        'chess opponent search'
      ),
      formulas: CHESS_SEARCH_FORMULAS,
      groupSize: 2,
    });
    if (result.outcome === 'unavailable')
      throw new MutationError(
        'CHESS_UNAVAILABLE',
        'Multiplayer chess is unavailable.'
      );
    await projectOpponentSearch(ctx.tx, ctx.env.actorId, now());
    await new Outbox(ctx).send({
      id: `chess.opponent-requested:${JSON.stringify([ctx.env.actorId, args.requestId])}`,
      message: OpponentRequested({ ownerId: ctx.env.actorId }),
    });
  },
});

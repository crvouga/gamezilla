import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { z } from 'zod';
import { MultiplayerGameRepository } from './game-repository';
import { beginOpponentSearch } from './opponent-search';

/** From a game that is over or aborted, look again at its time control in one step. */
export const findNewOpponentMutation = defineMutation({
  name: 'findNewChessOpponent',
  requiresOnline: true,
  pendingUx: 'pending',
  args: z.object({
    spaceId: z.string().min(1),
    requestId: z.string().min(1),
    gameId: z.string().min(1),
  }),
  async run(ctx, args) {
    const game = await new MultiplayerGameRepository(ctx.tx).owned(
      args.gameId,
      ctx.env.actorId
    );
    await beginOpponentSearch(ctx, {
      requestId: args.requestId,
      timeControl: game.time_control ?? '',
      spaceId: args.spaceId,
    });
  },
});

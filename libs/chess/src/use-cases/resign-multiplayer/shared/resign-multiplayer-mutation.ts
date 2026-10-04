import { requireInMutation } from '@libs/permissions/public/mutation-permission';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { defineMutation } from '@pkgs/sync-engine/shared';
import { z } from 'zod';
import { MultiplayerGameRepository } from '../../../shared/multiplayer/game-repository';

export const resignMultiplayerMutation = defineMutation({
  name: 'resignMultiplayer',
  requiresOnline: true,
  pendingUx: 'pending',
  args: z.object({ gameId: z.string().min(1), requestId: z.string().min(1) }),
  async run(ctx, args) {
    await requireInMutation(ctx, PERMISSION.chessMultiplayerResign);
    if (ctx.env.serverNow === undefined) return;
    const repository = new MultiplayerGameRepository(ctx.tx);
    const nowMs = (ctx.env.serverNow ?? ctx.env.now)().getTime();
    const game = await repository.owned(
      args.gameId,
      ctx.env.actorId,
      ctx.env.serverNow === undefined ? undefined : nowMs
    );
    if (
      await repository.repeated(
        ctx.env.actorId,
        args.requestId,
        args.gameId,
        'resign'
      )
    )
      return;
    if (game.outcome === 'ongoing')
      await repository.save(
        {
          ...game,
          outcome: game.white_id === ctx.env.actorId ? 'black' : 'white',
          reason: 'resignation',
          turn: '',
        },
        nowMs,
        ctx.env.serverNow !== undefined
      );
    await repository.remember(
      ctx.env.actorId,
      args.requestId,
      args.gameId,
      'resign'
    );
  },
});

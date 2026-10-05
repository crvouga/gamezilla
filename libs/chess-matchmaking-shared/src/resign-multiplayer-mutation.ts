import { requireInMutation } from '@libs/permissions-shared/mutation-permission';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { z } from 'zod';
import { requireMultiplayerParticipant } from './multiplayer-space-access';
import { MultiplayerGameRepository } from './game-repository';

export const resignMultiplayerMutation = defineMutation({
  name: 'resignMultiplayer',
  requiresOnline: true,
  pendingUx: 'pending',
  args: z.object({ spaceId: z.string().min(1), gameId: z.string().min(1), requestId: z.string().min(1) }),
  async run(ctx, args) {
    await requireMultiplayerParticipant(ctx, args);
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
        ctx.env
      );
    await repository.remember(
      ctx.env.actorId,
      args.requestId,
      args.gameId,
      'resign'
    );
  },
});

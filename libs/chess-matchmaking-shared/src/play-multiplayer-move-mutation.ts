import { requireInMutation } from '@libs/permissions-shared/mutation-permission';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { z } from 'zod';
import { playMultiplayerMove } from './game';
import { MultiplayerGameRepository } from './game-repository';
import { requireMultiplayerParticipant } from './multiplayer-space-access';

export const playMultiplayerMoveMutation = defineMutation({
  name: 'playMultiplayerMove',
  requiresOnline: true,
  pendingUx: 'pending',
  args: z.object({
    spaceId: z.string().min(1),
    gameId: z.string().min(1),
    requestId: z.string().min(1),
    revision: z.number().int().nonnegative(),
    uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
  }),
  async run(ctx, args) {
    await requireMultiplayerParticipant(ctx, args);
    await requireInMutation(ctx, PERMISSION.chessMultiplayerPlay);
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
        'move'
      )
    )
      return;
    const moved = playMultiplayerMove(game, {
      ...args,
      actorId: ctx.env.actorId,
    });
    await repository.save(moved, ctx.env);
    await repository.remember(
      ctx.env.actorId,
      args.requestId,
      args.gameId,
      'move'
    );
  },
});

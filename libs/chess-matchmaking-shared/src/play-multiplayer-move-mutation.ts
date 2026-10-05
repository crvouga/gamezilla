import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { z } from 'zod';
import { playMultiplayerMove } from './game';
import { gameCommandArgs, runGameCommand } from './game-command';

export const playMultiplayerMoveMutation = defineMutation({
  name: 'playMultiplayerMove',
  requiresOnline: true,
  pendingUx: 'pending',
  args: gameCommandArgs.extend({
    revision: z.number().int().nonnegative(),
    uci: z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/),
  }),
  run: (ctx, args) =>
    runGameCommand(ctx, { ...args, kind: 'move' }, (game, actorId, nowMs) =>
      playMultiplayerMove(game, { ...args, actorId, nowMs })
    ),
});

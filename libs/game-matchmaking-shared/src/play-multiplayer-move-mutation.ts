import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { requireTurnGames } from '@pkgs/turn-game-shared/game-rules';
import { z } from 'zod';
import { playMultiplayerMove } from './game';
import { gameCommandArgs, runGameCommand } from './game-command';

export const playMultiplayerMoveMutation = defineMutation({
  name: 'playMultiplayerMove',
  requiresOnline: true,
  pendingUx: 'pending',
  args: gameCommandArgs.extend({
    revision: z.number().int().nonnegative(),
    uci: z.string().min(1).max(256),
  }),
  run: (ctx, args) =>
    runGameCommand(ctx, { ...args, kind: 'move' }, (game, actorId, nowMs) =>
      playMultiplayerMove(
        game,
        { ...args, actorId, nowMs },
        requireTurnGames(ctx.env)
      )
    ),
});

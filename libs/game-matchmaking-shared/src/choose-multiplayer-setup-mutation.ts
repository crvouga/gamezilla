import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { requireTurnGames } from '@pkgs/turn-game-shared/game-rules';
import { z } from 'zod';
import { gameCommandArgs, runGameCommand } from './game-command';
import { chooseSetup, insertMultiplayerSetup } from './multiplayer-setup';

/** A person chooses their private setup for a matched game, once. */
export const chooseMultiplayerSetupMutation = defineMutation({
  name: 'chooseMultiplayerSetup',
  requiresOnline: true,
  pendingUx: 'pending',
  args: gameCommandArgs.extend({ setup: z.string().min(1).max(512) }),
  run: (ctx, args) =>
    runGameCommand(
      ctx,
      { ...args, kind: 'setup' },
      async (game, actorId, nowMs, tx) => {
        const chosen = chooseSetup(
          game,
          { actorId, setup: args.setup, nowMs },
          requireTurnGames(ctx.env)
        );
        await insertMultiplayerSetup(tx, {
          game,
          actorId,
          setup: chosen.setup,
          nowMs,
        });
        return chosen.game;
      }
    ),
});

import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { requireTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { z } from 'zod';
import { playMultiplayerMove } from './game';
import { gameCommandArgs, runGameCommand } from './game-command';
import {
  multiplayerHandsRules,
  readMultiplayerHidden,
  saveMultiplayerHands,
} from './multiplayer-hands';
import { readMultiplayerSetups } from './multiplayer-setup';

export const playMultiplayerMoveMutation = defineMutation({
  name: 'playMultiplayerMove',
  requiresOnline: true,
  pendingUx: 'pending',
  args: gameCommandArgs.extend({
    revision: z.number().int().nonnegative(),
    uci: z.string().min(1).max(256),
  }),
  run: (ctx, args) =>
    runGameCommand(
      ctx,
      { ...args, kind: 'move' },
      async (game, actorId, nowMs, tx) => {
        const rules = requireTurnGames(ctx.env);
        const dealt = multiplayerHandsRules(game, rules) !== undefined;
        const moved = playMultiplayerMove(
          game,
          {
            ...args,
            actorId,
            nowMs,
            setups:
              game.setup_ready === null
                ? null
                : await readMultiplayerSetups(tx, game.id),
            hidden: dealt ? await readMultiplayerHidden(tx, game.id) : null,
          },
          rules
        );
        // The hands change with the move, in the same transaction.
        if (moved.hidden !== null)
          await saveMultiplayerHands(tx, moved.game, {
            hidden: moved.hidden,
            rules,
            nowMs,
          });
        return moved.game;
      }
    ),
});

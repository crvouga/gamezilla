import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { gameCommandArgs, runGameCommand } from './game-command';

/**
 * A device saw a deadline pass (a missed first move or a clock at zero) and
 * asks the server to apply it; the server decides on its own clock.
 */
export const settleMultiplayerClockMutation = defineMutation({
  name: 'settleMultiplayerClock',
  requiresOnline: true,
  pendingUx: 'pending',
  args: gameCommandArgs,
  run: (ctx, args) =>
    runGameCommand(ctx, { ...args, kind: 'settle' }, (game) => game),
});

import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { gameCommandArgs, runGameCommand } from './game-command';
import { abortGame } from './game-decisions';

export const abortMultiplayerMutation = defineMutation({
  name: 'abortMultiplayer',
  requiresOnline: true,
  pendingUx: 'pending',
  args: gameCommandArgs,
  run: (ctx, args) =>
    runGameCommand(ctx, { ...args, kind: 'abort' }, abortGame),
});

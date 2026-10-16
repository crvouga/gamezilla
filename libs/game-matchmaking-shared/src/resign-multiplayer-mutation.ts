import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { gameCommandArgs, runGameCommand } from './game-command';
import { resignGame } from './game-decisions';

export const resignMultiplayerMutation = defineMutation({
  name: 'resignMultiplayer',
  requiresOnline: true,
  pendingUx: 'pending',
  args: gameCommandArgs,
  run: (ctx, args) =>
    runGameCommand(
      ctx,
      { ...args, kind: 'resign' },
      resignGame,
      PERMISSION.gameMultiplayerResign
    ),
});

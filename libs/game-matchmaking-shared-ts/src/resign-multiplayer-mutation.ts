import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
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
      (game, actorId) => resignGame(game, actorId),
      PERMISSION.gameMultiplayerResign
    ),
});

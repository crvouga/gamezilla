import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { gameCommandArgs, runGameCommand } from './game-command';
import { acceptDraw, declineDraw, offerDraw } from './game-decisions';

export const offerMultiplayerDrawMutation = defineMutation({
  name: 'offerMultiplayerDraw',
  requiresOnline: true,
  pendingUx: 'pending',
  args: gameCommandArgs,
  run: (ctx, args) =>
    runGameCommand(ctx, { ...args, kind: 'offer-draw' }, offerDraw),
});

export const acceptMultiplayerDrawMutation = defineMutation({
  name: 'acceptMultiplayerDraw',
  requiresOnline: true,
  pendingUx: 'pending',
  args: gameCommandArgs,
  run: (ctx, args) =>
    runGameCommand(ctx, { ...args, kind: 'accept-draw' }, acceptDraw),
});

export const declineMultiplayerDrawMutation = defineMutation({
  name: 'declineMultiplayerDraw',
  requiresOnline: true,
  pendingUx: 'pending',
  args: gameCommandArgs,
  run: (ctx, args) =>
    runGameCommand(ctx, { ...args, kind: 'decline-draw' }, declineDraw),
});

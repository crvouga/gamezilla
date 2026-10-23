import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { gameCommandArgs } from './game-command';
import { answerRematch } from './multiplayer-rematch';

export const offerMultiplayerRematchMutation = defineMutation({
  name: 'offerMultiplayerRematch',
  requiresOnline: true,
  pendingUx: 'pending',
  args: gameCommandArgs,
  run: (ctx, args) => answerRematch(ctx, { ...args, answer: 'offer' }),
});

export const acceptMultiplayerRematchMutation = defineMutation({
  name: 'acceptMultiplayerRematch',
  requiresOnline: true,
  pendingUx: 'pending',
  args: gameCommandArgs,
  run: (ctx, args) => answerRematch(ctx, { ...args, answer: 'accept' }),
});

export const declineMultiplayerRematchMutation = defineMutation({
  name: 'declineMultiplayerRematch',
  requiresOnline: true,
  pendingUx: 'pending',
  args: gameCommandArgs,
  run: (ctx, args) => answerRematch(ctx, { ...args, answer: 'decline' }),
});

import { requireInMutation } from '@libs/permissions-shared/mutation-permission';
import type { AppGrantKey } from '@libs/permissions-shared/permission-catalog';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import type { MutationCtx } from '@pkgs/sync-engine-shared/mutations-types';
import { z } from 'zod';
import { MultiplayerGameRepository } from './game-repository';
import type { MultiplayerGame } from './game-state';
import { settleMultiplayerClock } from './multiplayer-clock';
import { requireMultiplayerParticipant } from './multiplayer-space-access';

export const gameCommandArgs = z.object({
  spaceId: z.string().min(1),
  gameId: z.string().min(1),
  requestId: z.string().min(1),
});

export type GameCommandArgs = z.infer<typeof gameCommandArgs>;

export type GameDecision = (
  game: MultiplayerGame,
  actorId: string,
  nowMs: number
) => MultiplayerGame;

/**
 * One person's command on their game, decided on the server against the
 * game as it stands now (a missed first move or a flag already applied).
 * A repeated request keeps its one effect.
 */
export async function runGameCommand(
  ctx: MutationCtx,
  args: GameCommandArgs & { readonly kind: string },
  decide: GameDecision,
  permission: AppGrantKey = PERMISSION.chessMultiplayerPlay
): Promise<void> {
  await requireMultiplayerParticipant(ctx, args);
  await requireInMutation(ctx, permission);
  const serverNow = ctx.env.serverNow;
  if (serverNow === undefined) return;
  const nowMs = serverNow().getTime();
  const repository = new MultiplayerGameRepository(ctx.tx);
  const stored = await repository.owned(args.gameId, ctx.env.actorId, nowMs);
  if (
    await repository.repeated(
      ctx.env.actorId,
      args.requestId,
      args.gameId,
      args.kind
    )
  )
    return;
  const game = settleMultiplayerClock(stored, nowMs);
  await repository.save(stored, decide(game, ctx.env.actorId, nowMs), nowMs, {
    server: true,
    publish: ctx.env,
  });
  await repository.remember(
    ctx.env.actorId,
    args.requestId,
    args.gameId,
    args.kind
  );
}

import { requireInMutation } from '@libs/permissions-shared-ts/mutation-permission';
import type { AppGrantKey } from '@libs/permissions-shared-ts/permission-catalog';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import type { MutationCtx } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { requireTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { z } from 'zod';
import { MultiplayerGameRepository } from './game-repository';
import type { MultiplayerGame } from './game-state';
import { runLiveMatchCommand } from './live-match-command';
import { isMatchIntentKind, type MatchDecision } from './match-intent';
import { settleMultiplayerClock } from './multiplayer-clock';
import { readMultiplayerSetups } from './multiplayer-setup';
import { requireMultiplayerParticipant } from './multiplayer-space-access';

export const gameCommandArgs = z.object({
  spaceId: z.string().min(1),
  gameId: z.string().min(1),
  requestId: z.string().min(1),
});

export type GameCommandArgs = z.infer<typeof gameCommandArgs>;
export type GameCommandInput = GameCommandArgs &
  (
    | { readonly kind: 'move'; readonly revision: number; readonly uci: string }
    | {
        readonly kind:
          | 'setup'
          | 'abort'
          | 'resign'
          | 'offer-draw'
          | 'accept-draw'
          | 'decline-draw'
          | 'settle';
      }
  );

async function liveIntent(
  ctx: MutationCtx,
  args: GameCommandInput,
  game: MultiplayerGame
): Promise<MatchDecision & { readonly actorId: string }> {
  const actorId = ctx.env.actorId;
  if (args.kind === 'move')
    return {
      kind: 'move',
      actorId,
      revision: args.revision,
      uci: args.uci,
      setups:
        game.setup_ready === null
          ? null
          : await readMultiplayerSetups(ctx.tx, game.id),
    };
  const kind = args.kind === 'settle' ? 'sync' : args.kind;
  if (!isMatchIntentKind(kind))
    throw new Error('this command has no live decision');
  return { actorId, kind };
}

/**
 * The game after one person's command, decided under both people's owner
 * lock; it may read or write within the command's transaction (`tx`).
 */
export type GameDecision = (
  game: MultiplayerGame,
  actorId: string,
  nowMs: number,
  tx: SqlTx
) => MultiplayerGame | Promise<MultiplayerGame>;

/**
 * One person's command on their game, decided on the server against the
 * game as it stands now (a missed first move or a flag already applied).
 * A repeated request keeps its one effect.
 */
export async function runGameCommand(
  ctx: MutationCtx,
  args: GameCommandInput,
  decide: GameDecision,
  permission: AppGrantKey = PERMISSION.gameMultiplayerPlay
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
  if (stored.outcome === 'ongoing' && stored.paused_at_ms !== null)
    throw new MutationError(
      'CHESS_PLAY_UNAVAILABLE',
      'Multiplayer game is temporarily unavailable.'
    );
  const rules = requireTurnGames(ctx.env);
  const kind = args.kind === 'settle' ? 'sync' : args.kind;
  const live =
    rules.simulation(rules.forPosition(stored.fen).id) !== undefined &&
    isMatchIntentKind(kind);
  if (live && ctx.env.rooms === undefined)
    throw new Error('live matches require the injected room service');
  const game = settleMultiplayerClock(stored, nowMs, rules);
  const decided =
    live && ctx.env.rooms !== undefined && isMatchIntentKind(kind)
      ? await runLiveMatchCommand(
          ctx.env.rooms,
          stored,
          await liveIntent(ctx, args, stored),
          args.requestId
        )
      : await decide(game, ctx.env.actorId, nowMs, ctx.tx);
  await repository.save(stored, decided, nowMs, {
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

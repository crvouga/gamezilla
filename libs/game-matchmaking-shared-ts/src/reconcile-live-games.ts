import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationCtx } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { requireTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { synchronizeLiveMatchMutation } from './synchronize-live-match-mutation';

/** A new search observes authoritative results before enforcing unfinished-game limits. */
export async function reconcileLiveGames(
  ctx: MutationCtx,
  requestId: string
): Promise<void> {
  if (ctx.env.serverNow === undefined) return;
  const rules = requireTurnGames(ctx.env);
  const games = await ctx.tx.query(sql<{ id: string; fen: string }>`
    SELECT id, fen FROM chess_multiplayer_games
    WHERE (white_id = ${ctx.env.actorId} OR black_id = ${ctx.env.actorId})
      AND outcome = 'ongoing' AND deleted_at IS NULL`);
  for (const game of games) {
    if (rules.simulation(rules.forPosition(game.fen).id) === undefined)
      continue;
    await synchronizeLiveMatchMutation.run(ctx, {
      gameId: game.id,
      requestId: `search:${requestId}:${game.id}`,
    });
  }
}

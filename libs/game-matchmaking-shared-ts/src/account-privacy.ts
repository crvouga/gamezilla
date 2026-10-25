import { changeAvailability } from '@pkgs/matchmaking-sql-shared-ts/owner-repository';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationCtx } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { requireTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { MultiplayerGameRepository } from './game-repository';
import type { MultiplayerGame } from './game-state';
import { bothHaveMoved, endMultiplayerGame } from './game-state';
import { settleMultiplayerClock } from './multiplayer-clock';
import { multiplayerSides } from './multiplayer-roster';
import { publishMatchGame } from './publish-match-game';
import { projectOpponentSearch } from './search-projection';

/** A group withdrawal completes a draw; a pair retains its early-abort rule. */
function withdrawnGame(
  game: MultiplayerGame,
  actorId: string
): MultiplayerGame {
  if (multiplayerSides(game).length > 2)
    return endMultiplayerGame(game, 'draw', 'participant withdrew');
  if (!bothHaveMoved(game))
    return endMultiplayerGame(game, 'aborted', 'account deletion');
  return endMultiplayerGame(
    game,
    game.white_id === actorId ? 'black' : 'white',
    'account deletion'
  );
}

/** Account withdrawal and the opponent's lasting result share one transaction. */
export async function withdrawMultiplayer(ctx: MutationCtx): Promise<void> {
  const nowMs = (ctx.env.serverNow ?? ctx.env.now)().getTime();
  const games = await ctx.tx.query(sql<{
    id: string;
  }>`SELECT id FROM chess_multiplayer_games
    WHERE (white_id = ${ctx.env.actorId} OR black_id = ${ctx.env.actorId} OR red_id = ${ctx.env.actorId} OR blue_id = ${ctx.env.actorId}) AND outcome = 'ongoing' AND deleted_at IS NULL`);
  const repository = new MultiplayerGameRepository(ctx.tx);
  for (const row of games) {
    const stored = await repository.owned(
      row.id,
      ctx.env.actorId,
      ctx.env.serverNow === undefined ? undefined : nowMs
    );
    const game = settleMultiplayerClock(
      stored,
      nowMs,
      requireTurnGames(ctx.env)
    );
    await repository.save(
      stored,
      game.outcome === 'ongoing' ? withdrawnGame(game, ctx.env.actorId) : game,
      nowMs,
      { server: ctx.env.serverNow !== undefined, publish: ctx.env }
    );
  }
  if (ctx.env.serverNow !== undefined) {
    await changeAvailability(ctx.tx, {
      ownerId: ctx.env.actorId,
      available: false,
      nowMs,
    });
    await projectOpponentSearch(ctx.tx, ctx.env.actorId, nowMs);
  }
  const iso = new Date(nowMs).toISOString();
  await clearAgreements(ctx, iso);
  await ctx.tx.run(sql`UPDATE chess_opponent_searches SET standing = 'ended', deleted_at = ${iso}
    WHERE owner_id = ${ctx.env.actorId}`);
  await ctx.tx.run(
    sql`UPDATE chess_multiplayer_players SET deleted_at = ${iso} WHERE owner_id = ${ctx.env.actorId}`
  );
}

/** Losing a participant ends every pending agreement, including consent given to another person's offer. */
async function clearAgreements(ctx: MutationCtx, iso: string): Promise<void> {
  const affected = await ctx.tx.query(sql<{
    id: string;
  }>`SELECT id FROM chess_multiplayer_games
    WHERE (white_id = ${ctx.env.actorId} OR black_id = ${ctx.env.actorId} OR red_id = ${ctx.env.actorId} OR blue_id = ${ctx.env.actorId})
      AND (draw_offer_by <> ${''} OR rematch_offer_by <> ${''} OR draw_votes IS NOT NULL OR rematch_votes IS NOT NULL)`);
  await ctx.tx.run(sql`UPDATE chess_multiplayer_games
    SET draw_offer_by = ${''}, rematch_offer_by = ${''}, draw_votes = ${null}, rematch_votes = ${null}, updated_at = ${iso}
    WHERE white_id = ${ctx.env.actorId} OR black_id = ${ctx.env.actorId} OR red_id = ${ctx.env.actorId} OR blue_id = ${ctx.env.actorId}`);
  if (ctx.env.serverNow === undefined) return;
  const games = new MultiplayerGameRepository(ctx.tx);
  for (const row of affected) {
    const game = await games.byId(row.id);
    if (game !== null) await publishMatchGame(ctx, game);
  }
}

export async function eraseMultiplayer(ctx: MutationCtx): Promise<void> {
  const games = await ctx.tx.query(sql<{
    id: string;
    white_id: string;
    black_id: string;
    red_id: string | null;
    blue_id: string | null;
  }>`SELECT id, white_id, black_id, red_id, blue_id
    FROM chess_multiplayer_games WHERE white_id = ${ctx.env.actorId} OR black_id = ${ctx.env.actorId} OR red_id = ${ctx.env.actorId} OR blue_id = ${ctx.env.actorId}`);
  const repository = new MultiplayerGameRepository(ctx.tx);
  for (const game of games) {
    await ctx.tx.run(sql`UPDATE chess_multiplayer_games
    SET white_id = ${game.white_id === ctx.env.actorId ? `deleted:${game.id}:white` : game.white_id},
      black_id = ${game.black_id === ctx.env.actorId ? `deleted:${game.id}:black` : game.black_id},
      red_id = ${game.red_id === ctx.env.actorId ? `deleted:${game.id}:red` : game.red_id},
      blue_id = ${game.blue_id === ctx.env.actorId ? `deleted:${game.id}:blue` : game.blue_id},
      draw_offer_by = ${''}, rematch_offer_by = ${''}, draw_votes = ${null}, rematch_votes = ${null}
    WHERE id = ${game.id}`);
    if (ctx.env.serverNow !== undefined) {
      const updated = await repository.byId(game.id);
      if (updated) await publishMatchGame(ctx, updated);
    }
  }
  await ctx.tx.run(
    sql`UPDATE chess_multiplayer_players SET owner_id = ${null}, game_id = ${null} WHERE owner_id = ${ctx.env.actorId}`
  );
  await ctx.tx.run(
    sql`UPDATE chess_opponent_searches SET owner_id = ${null}, search_id = ${null}, match_id = ${null}, formulas = ${null} WHERE owner_id = ${ctx.env.actorId}`
  );
  await ctx.tx.run(
    sql`UPDATE chess_multiplayer_ratings SET owner_id = ${null} WHERE owner_id = ${ctx.env.actorId}`
  );
  await ctx.tx.run(
    sql`UPDATE chess_multiplayer_games SET draw_offer_by = ${''}, rematch_offer_by = ${''}, draw_votes = ${null}, rematch_votes = ${null}
    WHERE draw_offer_by = ${ctx.env.actorId} OR rematch_offer_by = ${ctx.env.actorId}`
  );
  await ctx.tx.run(
    sql`UPDATE chess_multiplayer_commands SET owner_id = ${null}, request_id = ${null}, game_id = ${null}, kind = ${null} WHERE owner_id = ${ctx.env.actorId}`
  );
  // A private setup is the person's own: nothing of it outlives the account.
  await ctx.tx.run(
    sql`UPDATE chess_multiplayer_setups SET owner_id = ${null}, setup = ${''} WHERE owner_id = ${ctx.env.actorId}`
  );
  // So is a dealt hand.
  await ctx.tx.run(
    sql`UPDATE chess_multiplayer_hands SET owner_id = ${null}, hand = ${''} WHERE owner_id = ${ctx.env.actorId}`
  );
}

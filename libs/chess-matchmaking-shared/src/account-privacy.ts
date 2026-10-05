import { changeAvailability } from '@pkgs/matchmaking-sql-shared/owner-repository';
import sql from '@pkgs/sql-root-shared/sql';
import type { MutationCtx } from '@pkgs/sync-engine-shared/mutations-types';
import { MultiplayerGameRepository } from './game-repository';
import type { MultiplayerGame } from './game-state';
import { bothHaveMoved, endMultiplayerGame } from './game-state';
import { settleMultiplayerClock } from './multiplayer-clock';
import { projectOpponentSearch } from './search-projection';

/** Before both people have moved the game is aborted; afterwards it is given up. */
function withdrawnGame(game: MultiplayerGame, actorId: string): MultiplayerGame {
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
    WHERE (white_id = ${ctx.env.actorId} OR black_id = ${ctx.env.actorId}) AND outcome = 'ongoing' AND deleted_at IS NULL`);
  const repository = new MultiplayerGameRepository(ctx.tx);
  for (const row of games) {
    const stored = await repository.owned(
      row.id,
      ctx.env.actorId,
      ctx.env.serverNow === undefined ? undefined : nowMs
    );
    const game = settleMultiplayerClock(stored, nowMs);
    await repository.save(
      stored,
      game.outcome === 'ongoing' ? withdrawnGame(game, ctx.env.actorId) : game,
      nowMs,
      ctx.env.serverNow !== undefined
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
  await ctx.tx.run(sql`UPDATE chess_multiplayer_games SET rematch_offer_by = ${''}, updated_at = ${iso}
    WHERE (white_id = ${ctx.env.actorId} OR black_id = ${ctx.env.actorId}) AND rematch_offer_by <> ${''}`);
  await ctx.tx.run(sql`UPDATE chess_opponent_searches SET standing = 'ended', deleted_at = ${iso}
    WHERE owner_id = ${ctx.env.actorId}`);
  await ctx.tx.run(
    sql`UPDATE chess_multiplayer_players SET deleted_at = ${iso} WHERE owner_id = ${ctx.env.actorId}`
  );
}

export async function eraseMultiplayer(ctx: MutationCtx): Promise<void> {
  const games = await ctx.tx.query(sql<{
    id: string;
    white_id: string;
    black_id: string;
  }>`SELECT id, white_id, black_id
    FROM chess_multiplayer_games WHERE white_id = ${ctx.env.actorId} OR black_id = ${ctx.env.actorId}`);
  for (const game of games)
    await ctx.tx.run(sql`UPDATE chess_multiplayer_games
    SET white_id = ${game.white_id === ctx.env.actorId ? `deleted:${game.id}:white` : game.white_id},
      black_id = ${game.black_id === ctx.env.actorId ? `deleted:${game.id}:black` : game.black_id}
    WHERE id = ${game.id}`);
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
    sql`UPDATE chess_multiplayer_games SET draw_offer_by = ${''}, rematch_offer_by = ${''}
    WHERE draw_offer_by = ${ctx.env.actorId} OR rematch_offer_by = ${ctx.env.actorId}`
  );
  await ctx.tx.run(
    sql`UPDATE chess_multiplayer_commands SET owner_id = ${null}, request_id = ${null}, game_id = ${null}, kind = ${null} WHERE owner_id = ${ctx.env.actorId}`
  );
}

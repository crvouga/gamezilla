import { changeAvailability } from '@pkgs/matchmaking-sql-shared/owner-repository';
import sql from '@pkgs/sql-root-shared/sql';
import type { MutationCtx } from '@pkgs/sync-engine-shared/mutations-types';
import type { MultiplayerGame } from './game';
import { MultiplayerGameRepository } from './game-repository';
import { publishMatchGame } from './publish-match-game';
import { projectOpponentSearch } from './search-projection';

/** Account withdrawal and the opponent's lasting result share one transaction. */
export async function withdrawMultiplayer(ctx: MutationCtx): Promise<void> {
  const nowMs = (ctx.env.serverNow ?? ctx.env.now)().getTime();
  const games = await ctx.tx.query(sql<{
    id: string;
  }>`SELECT id FROM chess_multiplayer_games
    WHERE (white_id = ${ctx.env.actorId} OR black_id = ${ctx.env.actorId}) AND outcome = 'ongoing' AND deleted_at IS NULL`);
  const repository = new MultiplayerGameRepository(ctx.tx);
  for (const row of games) {
    const game = await repository.owned(
      row.id,
      ctx.env.actorId,
      ctx.env.serverNow === undefined ? undefined : nowMs
    );
    if (game.outcome === 'ongoing')
      await repository.save(
        {
          ...game,
          outcome: game.white_id === ctx.env.actorId ? 'black' : 'white',
          turn: '',
          reason: 'account deletion',
        },
        ctx.env
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
  for (const game of games) {
    await ctx.tx.run(sql`UPDATE chess_multiplayer_games
    SET white_id = ${game.white_id === ctx.env.actorId ? `deleted:${game.id}:white` : game.white_id},
      black_id = ${game.black_id === ctx.env.actorId ? `deleted:${game.id}:black` : game.black_id}
    WHERE id = ${game.id}`);
    if (ctx.env.serverNow !== undefined) {
      const updated = (
        await ctx.tx.query(
          sql<MultiplayerGame>`SELECT id, white_id, black_id, fen, pgn, revision, turn, outcome, reason FROM chess_multiplayer_games WHERE id = ${game.id}`
        )
      )[0];
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
    sql`UPDATE chess_multiplayer_commands SET owner_id = ${null}, request_id = ${null}, game_id = ${null}, kind = ${null} WHERE owner_id = ${ctx.env.actorId}`
  );
}

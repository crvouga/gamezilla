import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { queryRequires } from '@libs/permissions/public/query-permission';
import { profilesByIds } from '@libs/profile/public/profile-query';
import { join, sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

export const chessMultiplayerSession = defineQuery({
  name: 'chessMultiplayerSession',
  authorize: queryRequires(PERMISSION.matchmakingView),
  async run(ctx) {
    const players = await ctx.db.query(
      sql`SELECT * FROM chess_multiplayer_players WHERE owner_id = ${ctx.env.actorId}`
    );
    const gameIds = players
      .map((player) => player['game_id'])
      .filter((id): id is string => typeof id === 'string');
    const games = await ctx.db.query(sql`SELECT * FROM chess_multiplayer_games
      WHERE id IN (${join(gameIds.length > 0 ? gameIds : ['__no_multiplayer_game__'])})
      AND (white_id = ${ctx.env.actorId} OR black_id = ${ctx.env.actorId})`);
    const searches = await ctx.db.query(
      sql`SELECT * FROM chess_opponent_searches WHERE owner_id = ${ctx.env.actorId}`
    );
    const ids = [
      ...new Set(games.flatMap((game) => [game['white_id'], game['black_id']])),
    ].filter((id): id is string => typeof id === 'string' && id.length > 0);
    const profiles = await profilesByIds.run(ctx, {
      ids: ids.length > 0 ? ids : ['__no_multiplayer_profile__'],
    });
    return {
      ...profiles,
      chess_multiplayer_players: players,
      chess_multiplayer_games: games,
      chess_opponent_searches: searches,
    };
  },
});

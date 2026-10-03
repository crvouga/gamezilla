import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { queryRequires } from '@libs/permissions/public/query-permission';
import { profilesByIds } from '@libs/profile/public/profile-query';
import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

export const chessMultiplayerSession = defineQuery({
  name: 'chessMultiplayerSession',
  authorize: queryRequires(PERMISSION.matchmakingView),
  async run(ctx) {
    const players = await ctx.db.query(
      sql`SELECT * FROM chess_multiplayer_players WHERE owner_id = ${ctx.env.actorId}`
    );
    const games =
      await ctx.db.query(sql`SELECT g.* FROM chess_multiplayer_games AS g
      JOIN chess_multiplayer_players AS p ON p.game_id = g.id
      WHERE p.owner_id = ${ctx.env.actorId} AND (g.white_id = ${ctx.env.actorId} OR g.black_id = ${ctx.env.actorId})`);
    const searches = await ctx.db.query(
      sql`SELECT * FROM chess_opponent_searches WHERE owner_id = ${ctx.env.actorId}`
    );
    const ids = [
      ...new Set(games.flatMap((game) => [game['white_id'], game['black_id']])),
    ].filter((id): id is string => typeof id === 'string' && id.length > 0);
    const profiles =
      ids.length === 0
        ? { profile: [] }
        : await profilesByIds.run(ctx, { ids });
    return {
      ...profiles,
      chess_multiplayer_players: players,
      chess_multiplayer_games: games,
      chess_opponent_searches: searches,
    };
  },
});

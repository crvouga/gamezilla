import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { queryRequires } from '@libs/permissions-shared-ts/query-permission';
import { profilesByIds } from '@libs/profile-shared-ts/profiles-by-ids-query';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';

export const multiplayerSessionQuery = defineQuery({
  name: 'chessMultiplayerSession',
  authorize: queryRequires(PERMISSION.matchmakingView),
  async run(ctx) {
    const players = await ctx.db.query(
      sql`SELECT * FROM chess_multiplayer_players WHERE owner_id = ${ctx.env.actorId}`
    );
    const games = await ctx.db.query(sql`SELECT * FROM chess_multiplayer_games
      WHERE white_id = ${ctx.env.actorId} OR black_id = ${ctx.env.actorId} OR red_id = ${ctx.env.actorId} OR blue_id = ${ctx.env.actorId}
      ORDER BY created_at DESC`);
    const searches = await ctx.db.query(
      sql`SELECT * FROM chess_opponent_searches WHERE owner_id = ${ctx.env.actorId}`
    );
    const ids = [
      ...new Set(
        games.flatMap((game) => [
          game['white_id'],
          game['black_id'],
          game['red_id'],
          game['blue_id'],
        ])
      ),
    ].filter((id): id is string => typeof id === 'string' && id.length > 0);
    const profiles = await profilesByIds.run(ctx, {
      ids: ids.length > 0 ? ids : ['__no_multiplayer_profile__'],
    });
    const ratings = await ctx.db.query(
      sql`SELECT * FROM chess_multiplayer_ratings WHERE owner_id = ${ctx.env.actorId}`
    );
    // A person's own private setups, and nobody else's.
    const setups = await ctx.db.query(
      sql`SELECT * FROM chess_multiplayer_setups WHERE owner_id = ${ctx.env.actorId}`
    );
    // A person's own dealt hands, and nobody else's; never the hidden state.
    const hands = await ctx.db.query(
      sql`SELECT * FROM chess_multiplayer_hands WHERE owner_id = ${ctx.env.actorId}`
    );
    return {
      ...profiles,
      chess_multiplayer_ratings: ratings,
      chess_multiplayer_setups: setups,
      chess_multiplayer_hands: hands,
      chess_multiplayer_players: players,
      chess_multiplayer_games: games,
      chess_opponent_searches: searches,
    };
  },
});

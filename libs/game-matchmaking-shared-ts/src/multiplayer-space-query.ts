import { decideForActor } from '@libs/permissions-shared-ts/decide-for-actor';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { profilesByIds } from '@libs/profile-shared-ts/profiles-by-ids-query';
import { storedSpacePresence } from '@libs/spaces-shared-ts/stored-space-presence';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';
import { z } from 'zod';

export const multiplayerSpaceQuery = defineQuery({
  name: 'chessMultiplayerSpace',
  params: z.object({ spaceId: z.string().min(1) }),
  entryChannel: (params) => [`room:${params.spaceId}`],
  sampleParams: { spaceId: 'friday-chess' },
  async authorize(ctx, params) {
    const db = {
      query: <T>(query: Sql<T>) => ctx.db.query(query) as Promise<T[]>,
    };
    const actor = {
      memberId: ctx.env.actorId,
      accountId: ctx.env.accountId ?? null,
      deviceId: ctx.env.deviceId ?? ctx.env.actorId,
    };
    const spacePresence = await storedSpacePresence(db, params.spaceId, actor);
    const nowMs = ctx.env.now().getTime();
    return (
      await decideForActor(db, {
        identity: ctx.env,
        key: PERMISSION.gameMultiplayerWatch,
        nowMs,
        clientAtMs: nowMs,
        scope: { spacePresence },
      })
    ).allowed;
  },
  async run(ctx, params) {
    const spaces = await ctx.db.query(sql<{
      host_member_id: string;
    }>`SELECT id, host_member_id, deleted_at FROM spaces
      WHERE id = ${params.spaceId}`);
    const hostId = String(spaces[0]?.['host_member_id'] ?? '');
    const players = await ctx.db.query(
      sql`SELECT * FROM chess_multiplayer_players WHERE owner_id = ${hostId}`
    );
    const games =
      await ctx.db.query(sql`SELECT g.* FROM chess_multiplayer_games AS g
      JOIN chess_multiplayer_players AS p ON p.game_id = g.id
      WHERE p.owner_id = ${hostId}`);
    const searches = await ctx.db.query(
      sql`SELECT * FROM chess_opponent_searches WHERE owner_id = ${hostId}`
    );
    const ids = games
      .flatMap((game) => [
        game['white_id'],
        game['black_id'],
        game['red_id'],
        game['blue_id'],
      ])
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const profiles = await profilesByIds.run(ctx, {
      ids: ids.length > 0 ? ids : ['__no_match_profile__'],
    });
    return {
      ...profiles,
      chess_multiplayer_players: players,
      chess_multiplayer_games: games,
      chess_opponent_searches: searches,
    };
  },
});

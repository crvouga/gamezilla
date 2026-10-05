import { decideForActor } from '@libs/permissions-shared/decide-for-actor';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { profilesByIds } from '@libs/profile-shared/profiles-by-ids-query';
import { storedSpacePresence } from '@libs/spaces-shared/stored-space-presence';
import type { Sql } from '@pkgs/sql-root-shared/sql';
import sql from '@pkgs/sql-root-shared/sql';
import { defineQuery } from '@pkgs/sync-engine-shared/define-query';
import { z } from 'zod';

export const chessMultiplayerSpace = defineQuery({
  name: 'chessMultiplayerSpace',
  params: z.object({ spaceId: z.string().min(1) }),
  entryChannel: params => [`room:${params.spaceId}`],
  sampleParams: { spaceId: 'friday-chess' },
  async authorize(ctx, params) {
    const db = { query: <T>(query: Sql<T>) => ctx.db.query(query) as Promise<T[]> };
    const actor = { memberId: ctx.env.actorId, accountId: ctx.env.accountId ?? null, deviceId: ctx.env.deviceId ?? ctx.env.actorId };
    const spacePresence = await storedSpacePresence(db, params.spaceId, actor);
    const nowMs = ctx.env.now().getTime();
    return (await decideForActor(db, { identity: ctx.env, key: PERMISSION.chessMultiplayerWatch,
      nowMs, clientAtMs: nowMs, scope: { spacePresence } })).allowed;
  },
  async run(ctx, params) {
    const spaces = await ctx.db.query(sql<{ host_member_id: string }>`SELECT host_member_id FROM spaces
      WHERE id = ${params.spaceId} AND ended_at IS NULL AND deleted_at IS NULL`);
    const hostId = String(spaces[0]?.['host_member_id'] ?? '');
    const players = await ctx.db.query(sql`SELECT * FROM chess_multiplayer_players WHERE owner_id = ${hostId}`);
    const games = await ctx.db.query(sql`SELECT g.* FROM chess_multiplayer_games AS g
      JOIN chess_multiplayer_players AS p ON p.game_id = g.id
      WHERE p.owner_id = ${hostId} AND p.deleted_at IS NULL`);
    const searches = await ctx.db.query(sql`SELECT * FROM chess_opponent_searches WHERE owner_id = ${hostId}`);
    const ids = games.flatMap(game => [game['white_id'], game['black_id']])
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const profiles = await profilesByIds.run(ctx, { ids: ids.length > 0 ? ids : ['__no_match_profile__'] });
    return { ...profiles, chess_multiplayer_players: players, chess_multiplayer_games: games, chess_opponent_searches: searches };
  },
});

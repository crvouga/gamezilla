import sql, { join } from '@pkgs/sql-root-shared-ts/sql';
import { defineQuery } from '@pkgs/sync-engine-shared-ts/define-query';

type FriendshipRow = {
  readonly id: string;
  readonly user_low: string;
  readonly user_high: string;
  readonly created_at: string;
  readonly source_request_id: string | null;
  readonly deleted_at: string | null;
};

function peerId(actor: string, row: FriendshipRow): string {
  return row.user_low === actor ? row.user_high : row.user_low;
}

/** Sentinel so profile IN (...) always has one shape (join([]) throws). */
const PROFILE_IN_SENTINEL = '__workload_sentinel__';

export const friendships = defineQuery({
  name: 'friendships',
  async run(ctx) {
    const actor = ctx.env.actorId;
    const rows = (await ctx.db.query(sql<FriendshipRow>`
      SELECT id, user_low, user_high, created_at, source_request_id, deleted_at
      FROM friends_friendships
      WHERE user_low = ${actor} OR user_high = ${actor}
`)) as FriendshipRow[];
    const peerIds = [
      ...new Set(
        rows
          .map((row) => peerId(actor, row))
          .filter((id) => id.length > 0 && id !== actor)
      ),
    ];
    // Always emit the profile query — one SQL shape per defineQuery (workload extract).
    const idsForIn = peerIds.length > 0 ? peerIds : [PROFILE_IN_SENTINEL];
    const profiles = await ctx.db.query(sql`
      SELECT id, created_at, username, username_norm, avatar_config, username_changed_at, account_kind, deleted_at
      FROM profile
      WHERE id IN (${join(idsForIn)})
`);
    return {
      friends_friendships: rows,
      profile: peerIds.length > 0 ? profiles : [],
    };
  },
});

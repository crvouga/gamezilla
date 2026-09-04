import { join, sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';

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

export const friendships = defineQuery({
  name: 'friendships',
  async run(ctx) {
    const actor = ctx.env.actorId;
    const q = sql<FriendshipRow>`
    SELECT id, user_low, user_high, created_at, source_request_id, deleted_at
    FROM friends_friendships
    WHERE user_low = ${actor} OR user_high = ${actor}`;
    const rows = (await ctx.db.query(q)) as FriendshipRow[];

    const peerIds = [
      ...new Set(
        rows
          .map((row) => peerId(actor, row))
          .filter((id) => id.length > 0 && id !== actor)
      ),
    ];
    if (peerIds.length === 0) {
      return { friends_friendships: rows, profile: [] };
    }
    const profiles = await ctx.db.query(sql`
      SELECT id, created_at, username, avatar_config, username_changed_at, deleted_at
      FROM profile
      WHERE id IN (${join(peerIds)})
`);
    return { friends_friendships: rows, profile: profiles };
  },
});

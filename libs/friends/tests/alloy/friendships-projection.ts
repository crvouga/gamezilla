/**
 * Stored friends rows as a world of `specs/friends/friendships.als`. The same
 * SQL reads the server's database and a device's copy (both keep the
 * friends tables with the same columns); only live rows count.
 *
 * - `Person`: every person the store knows of (see `stored-people.ts`).
 * - `friend`: a live friendship row, which the product stores once per pair
 *   (`user_low`, `user_high`); being friends is both ways, so both tuples.
 * - `friendRequests`: a live request still `pending` — the one that waits
 *   for an answer (accepted, declined and cancelled requests are answered).
 * - `blocks`: a live block, blocker → blocked.
 */

import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

import type { Names, World } from './snapshot-worlds';
import {
  bothWays,
  named,
  type Pair,
  sortedSet,
  storedPeople,
} from './stored-people';

export type FriendsRows = {
  readonly friendships: readonly Pair[];
  readonly requests: readonly Pair[];
  readonly blocks: readonly Pair[];
};

export async function friendsRows(db: SqlTx): Promise<FriendsRows> {
  const friendships = await db.query(sql<{
    readonly user_low: string;
    readonly user_high: string;
  }>`
    SELECT user_low, user_high FROM friends_friendships
    WHERE deleted_at IS NULL`);
  const requests = await db.query(sql<{
    readonly from_user_id: string;
    readonly to_user_id: string;
  }>`
    SELECT from_user_id, to_user_id FROM friends_requests
    WHERE deleted_at IS NULL AND status = 'pending'`);
  const blocks = await db.query(sql<{
    readonly blocker_id: string;
    readonly blocked_id: string;
  }>`
    SELECT blocker_id, blocked_id FROM friends_blocks
    WHERE deleted_at IS NULL`);
  return {
    friendships: friendships.map((r) => [r.user_low, r.user_high] as const),
    requests: requests.map((r) => [r.from_user_id, r.to_user_id] as const),
    blocks: blocks.map((r) => [r.blocker_id, r.blocked_id] as const),
  };
}

export async function projectFriendships(
  db: SqlTx,
  names: Names
): Promise<World> {
  const rows = await friendsRows(db);
  const people = sortedSet(
    [
      ...(await storedPeople(db)),
      ...[rows.friendships, rows.requests, rows.blocks].flat(2),
    ].map(names)
  );
  return {
    atoms: { Person: people },
    relations: {
      friend: named(bothWays(rows.friendships), names),
      friendRequests: named(rows.requests, names),
      blocks: named(rows.blocks, names),
    },
  };
}

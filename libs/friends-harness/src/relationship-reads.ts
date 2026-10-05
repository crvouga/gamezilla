/** Read the relationship state behind search, profile pills, and the inbox. */

import type { ProductHarness } from '@libs/harness/harness';
import { accountIdOf, actorLocalSql } from '@libs/harness/identity';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import { variant } from '@pkgs/quint-shared/itf';
import sql from '@pkgs/sql-root-shared/sql';

/** A sent request has reached the shared state even when its recipient is away. */
export async function pendingRequestStored(
  s: ProductHarness,
  from: string,
  to: string
): Promise<boolean> {
  const sender = await accountIdOf(s, from);
  const recipient = await accountIdOf(s, to);
  const rows = await s.harness.serverSql.sqlClient.query(sql<{
    readonly id: string;
  }>`
    SELECT id FROM friends_requests
    WHERE from_user_id = ${sender} AND to_user_id = ${recipient}
      AND status = 'pending' AND deleted_at IS NULL`);
  return rows.length > 0;
}

type Rows = {
  /** `blocker>blocked` account pairs. */
  readonly blocks: ReadonlySet<string>;
  /** `low:high` account pairs. */
  readonly friendships: ReadonlySet<string>;
  /** `from>to` account pairs of waiting friend requests. */
  readonly friendRequests: ReadonlySet<string>;
};

/** The friends rows on `actorId`'s device. */
export async function localRows(
  s: ProductHarness,
  actorId: string
): Promise<Rows> {
  const local = actorLocalSql(s, actorId);
  if (local === null) {
    return {
      blocks: new Set(),
      friendships: new Set(),
      friendRequests: new Set(),
    };
  }
  const blocks = await local.query(sql<{
    readonly blocker_id: string;
    readonly blocked_id: string;
  }>`
    SELECT blocker_id, blocked_id FROM friends_blocks WHERE deleted_at IS NULL`);
  const friendships = await local.query(sql<{
    readonly user_low: string;
    readonly user_high: string;
  }>`
    SELECT user_low, user_high FROM friends_friendships WHERE deleted_at IS NULL`);
  const pending = await local.query(sql<{
    readonly from_user_id: string;
    readonly to_user_id: string;
  }>`
    SELECT from_user_id, to_user_id FROM friends_requests
    WHERE status = 'pending'`);
  return {
    blocks: new Set(blocks.map((r) => `${r.blocker_id}>${r.blocked_id}`)),
    friendships: new Set(
      friendships.map((r) => `${r.user_low}:${r.user_high}`)
    ),
    friendRequests: new Set(
      pending.map((r) => `${r.from_user_id}>${r.to_user_id}`)
    ),
  };
}

/**
 * `me`'s friendship status with `them`, by the precedence the product renders: their
 * profile's pill (Unblock, Friends, Requested, Confirm / Delete, Add), and
 * search leaving out someone who blocked `me`.
 */
export function friendshipStatusOf(
  rows: Rows,
  me: string,
  them: string
): QuintValue {
  const [low, high] = me < them ? [me, them] : [them, me];
  if (rows.blocks.has(`${me}>${them}`)) return variant('Blocking');
  if (rows.blocks.has(`${them}>${me}`)) return variant('Hidden');
  if (rows.friendships.has(`${low}:${high}`)) return variant('Friend');
  if (rows.friendRequests.has(`${me}>${them}`)) return variant('RequestSent');
  if (rows.friendRequests.has(`${them}>${me}`))
    return variant('RequestReceived');
  return variant('Stranger');
}

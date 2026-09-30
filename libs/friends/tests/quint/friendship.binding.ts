/**
 * `specs/friends/friendship.qnt` against the friends composition: each Quint
 * action through the friends harness actions (search, the inbox, another
 * person's profile), and each person's friendship status with each other person read off
 * their device's synced copy — the rows the profile pills, the inbox, the
 * friends list and search render from.
 */

import {
  acceptFriendRequest,
  addFriend,
  cancelFriendRequest,
  declineFriendRequest,
  removeFriend,
  unblockFriend,
} from '@libs/friends/harness/friends-actions';
import {
  blockPerson,
  confirmFromProfile,
  declineFromProfile,
  openPersonFromSearch,
} from '@libs/friends/harness/person-actions';
import {
  backToTabs,
  focusActor,
  returnToTabs,
  signInWithGoogle,
} from '@libs/harness';
import type { QuintHarnessWorld } from '@libs/harness/quint/world';
import type { ProductHarness } from '@libs/harness/system/harness';
import { accountIdOf, actorLocalSql } from '@libs/harness/system/identity';
import { searchUsername } from '@libs/search/harness/search-actions';
import { type QuintValue, variant } from '@pkgs/quint/itf';
import { bindQuintModel, type Picks } from '@pkgs/quint/registry';
import { sql } from '@pkgs/sql';

const PEOPLE = ['alice', 'bob', 'carol'] as const;

type Pair = { readonly actor: string; readonly other: string };

function pair(picks: Picks): Pair {
  return { actor: String(picks['person']), other: String(picks['other']) };
}

function accountKey(actor: string): string {
  return `account:${actor}`;
}

function accountOf(w: QuintHarnessWorld, actor: string): string {
  const id = w.memo.get(accountKey(actor));
  if (typeof id !== 'string') throw new Error(`${actor} has no account`);
  return id;
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
async function localRows(s: ProductHarness, actorId: string): Promise<Rows> {
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
function friendshipStatusOf(rows: Rows, me: string, them: string): QuintValue {
  const [low, high] = me < them ? [me, them] : [them, me];
  if (rows.blocks.has(`${me}>${them}`)) return variant('Blocking');
  if (rows.blocks.has(`${them}>${me}`)) return variant('Hidden');
  if (rows.friendships.has(`${low}:${high}`)) return variant('Friend');
  if (rows.friendRequests.has(`${me}>${them}`)) return variant('RequestSent');
  if (rows.friendRequests.has(`${them}>${me}`))
    return variant('RequestReceived');
  return variant('Stranger');
}

/**
 * Bring the person's phone to the front (a parked phone's screen reads as
 * empty) and back out to the tab bar, wherever their last step left them.
 */
async function toTabs(w: QuintHarnessWorld, actor: string): Promise<void> {
  await w.s.apply(focusActor, actor);
  await w.s.apply(backToTabs, actor);
}

bindQuintModel<QuintHarnessWorld>({
  model: 'friendship',
  traces: 24,
  maxSteps: 24,
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      for (const actor of PEOPLE) {
        await w.s.apply(signInWithGoogle, actor);
        await w.s.apply(returnToTabs, actor);
        const id = await w.s.read(accountIdOf, actor);
        if (id === null) throw new Error(`${actor} has no account`);
        w.memo.set(accountKey(actor), id);
      }
    },
    ask: async (w, picks) => {
      const { actor, other } = pair(picks);
      await toTabs(w, actor);
      await w.s.apply(searchUsername, actor, other);
      await w.s.apply(addFriend, actor, other);
    },
    cancel: async (w, picks) => {
      const { actor, other } = pair(picks);
      await toTabs(w, actor);
      await w.s.apply(searchUsername, actor, other);
      await w.s.apply(cancelFriendRequest, actor, other);
    },
    accept: async (w, picks) => {
      const { actor, other } = pair(picks);
      await toTabs(w, actor);
      await w.s.apply(acceptFriendRequest, actor, other);
    },
    acceptFromProfile: async (w, picks) => {
      const { actor, other } = pair(picks);
      await toTabs(w, actor);
      await w.s.apply(openPersonFromSearch, actor, other);
      await w.s.apply(confirmFromProfile, actor, other);
    },
    decline: async (w, picks) => {
      const { actor, other } = pair(picks);
      await toTabs(w, actor);
      await w.s.apply(declineFriendRequest, actor, other);
    },
    declineFromProfile: async (w, picks) => {
      const { actor, other } = pair(picks);
      await toTabs(w, actor);
      await w.s.apply(openPersonFromSearch, actor, other);
      await w.s.apply(declineFromProfile, actor, other);
    },
    remove: async (w, picks) => {
      const { actor, other } = pair(picks);
      await toTabs(w, actor);
      await w.s.apply(removeFriend, actor, other);
    },
    block: async (w, picks) => {
      const { actor, other } = pair(picks);
      await toTabs(w, actor);
      await w.s.apply(openPersonFromSearch, actor, other);
      await w.s.apply(blockPerson, actor, other);
    },
    unblock: async (w, picks) => {
      const { actor, other } = pair(picks);
      await toTabs(w, actor);
      await w.s.apply(unblockFriend, actor, other);
    },
    _loseConnection: () => Promise.resolve(),
    _connectionReturns: () => Promise.resolve(),
  },
  observe: async (w) => {
    const friendshipStatus = new Map<QuintValue, QuintValue>();
    for (const actor of PEOPLE) {
      const rows = await w.quiet.read(localRows, actor);
      const me = accountOf(w, actor);
      const statuses = new Map<QuintValue, QuintValue>();
      for (const other of PEOPLE) {
        if (other !== actor)
          statuses.set(
            other,
            friendshipStatusOf(rows, me, accountOf(w, other))
          );
      }
      friendshipStatus.set(actor, statuses);
    }
    return { friendshipStatus };
  },
});

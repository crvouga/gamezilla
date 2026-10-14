import {
  friendshipStatusOf,
  localRows,
} from '@libs/friends-harness/relationship-reads';
import { sharedRelationships } from '@libs/friends-harness/shared-relationship-reads';
import { letTimePass, partition, restoreNetwork } from '@libs/harness/actions';
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
} from '@libs/friends-harness/friends-actions';
import {
  blockPerson,
  confirmFromProfile,
  declineFromProfile,
  openPersonFromSearch,
} from '@libs/friends-harness/person-actions';
import {
  claimActorUsername,
  returnToTabs,
  signInWithGoogle,
} from '@libs/harness/auth-actions';
import { accountIdOf } from '@libs/harness/identity';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { backToTabs, focusActor } from '@libs/harness/shell-actions';
import { searchUsername } from '@libs/search-harness/search-actions';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

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
  inductiveInvariant: '_inductive',
  traces: 64,
  maxSteps: 32,
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      for (const actor of PEOPLE) {
        await w.s.apply(signInWithGoogle, actor);
        await w.s.apply(claimActorUsername, actor);
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
    dayPasses: async (w) => {
      await w.s.apply(letTimePass, 24 * 60 * 60 * 1000);
    },
    _loseConnection: async (w, picks) => {
      await w.s.apply(partition, String(picks['person']));
      await w.s.advanceTime(1_000);
    },
    _connectionReturns: async (w) => {
      await w.s.apply(restoreNetwork);
      await w.s.advanceTime(1_000);
    },
  },
  observe: async (w) => {
    const friendshipStatus = new Map<QuintValue, QuintValue>();
    for (const actor of PEOPLE) {
      const rows = await w.quiet.read(localRows, actor);
      const me = accountOf(w, actor);
      for (const other of PEOPLE) {
        if (other !== actor)
          friendshipStatus.set(
            [actor, other],
            friendshipStatusOf(rows, me, accountOf(w, other))
          );
      }
    }
    const shared = await w.quiet.read(sharedRelationships, PEOPLE);
    return { ...shared, friendshipStatus };
  },
});

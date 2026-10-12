import { openPersonFromSearch } from '@libs/friends-harness/person-actions';
import { partition, restoreNetwork } from '@libs/harness/actions';
import {
  claimActorUsername,
  signInWithGoogle,
} from '@libs/harness/auth-actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import {
  nameEveryoneSeesOf,
  profileIdOf,
} from '@libs/profile-harness/profile-ui-reads';
import {
  joinViaLink,
  leaveSpace,
  openSpaceLink,
  openSpacesTab,
  startSpace,
} from '@libs/spaces-harness/space-actions';
import { addPersonToSpace } from '@libs/spaces-harness/space-addition-actions';
import {
  closeSpaceShare,
  removePersonFromSpace,
} from '@libs/spaces-harness/space-removal-actions';
import { spaceScreenOf } from '@libs/spaces-harness/space-screen-read';
import {
  lobbySpaceCardVisible,
  readSpaceLink,
} from '@libs/spaces-harness/spaces-ui-reads';
import { variant } from '@pkgs/quint-shared/itf';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

const LINK = 'adding-people-link';
function link(w: QuintHarnessWorld): string {
  const value = w.memo.get(LINK);
  if (typeof value !== 'string') throw new Error('No actual hosted space link');
  return value;
}

bindQuintModel<QuintHarnessWorld>({
  model: 'adding-people',
  traces: 32,
  maxSteps: 24,
  inductiveInvariant: '_inductive',
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      await w.s.apply(signInWithGoogle, 'alice');
      await w.s.apply(claimActorUsername, 'alice');
      await w.s.apply(signInWithGoogle, 'bob');
      await w.s.apply(claimActorUsername, 'bob');
      await w.s.apply(openPersonFromSearch, 'alice', 'bob');
      await w.s.apply(openSpacesTab, 'alice');
      await w.s.apply(startSpace, 'alice');
      const actual = await w.s.read(readSpaceLink, 'alice');
      if (actual === null) throw new Error('Host has no link');
      w.memo.set(LINK, actual);
      await w.s.apply(openSpacesTab, 'bob');
    },
    addPerson: async (w) => {
      const id = await w.s.read(profileIdOf, 'bob');
      const name = await w.s.read(nameEveryoneSeesOf, 'bob');
      if (id === null || name === null) throw new Error('No known Bob profile');
      await w.s.apply(addPersonToSpace, 'alice', id, name);
      await w.s.apply(closeSpaceShare, 'alice');
    },
    removePerson: async (w) => {
      const id = await w.s.read(profileIdOf, 'bob');
      if (id === null) throw new Error('No known Bob profile');
      await w.s.apply(removePersonFromSpace, 'alice', id);
      await w.s.apply(closeSpaceShare, 'alice');
    },
    openSpaceLink: async (w) => {
      await w.s.apply(openSpaceLink, 'bob', link(w));
    },
    join: async (w) => {
      await w.s.apply(joinViaLink, 'bob', link(w));
    },
    leaveHost: async (w) => {
      await w.s.apply(leaveSpace, 'alice');
    },
    loseConnection: async (w, picks) => {
      const before = await w.quiet.read(spaceScreenOf, 'bob');
      await w.s.apply(partition, picks['person'] as string);
      await w.s.advanceTime(2_000);
      if (before === 'space') {
        await w.quiet.until((s) => spaceScreenOf(s, 'bob'), {
          pred: (screen) => screen === 'droppedOut',
          maxMs: 20_000,
        });
      }
    },
    connectionReturns: async (w) => {
      await w.s.apply(restoreNetwork);
      await w.s.advanceTime(2_000);
    },
  },
  observe: async (w) => {
    const where = new Map<string, ReturnType<typeof variant>>();
    const lobbies = new Map<string, Set<string>>();
    const names = {
      lobby: 'Lobby',
      space: 'InSpace',
      left: 'Left',
      ended: 'Ended',
      droppedOut: 'DroppedOut',
    } as const;
    for (const person of ['alice', 'bob']) {
      const screen = await w.quiet.read(spaceScreenOf, person);
      where.set(
        person,
        variant(
          screen in names ? names[screen as keyof typeof names] : 'Elsewhere'
        )
      );
      lobbies.set(
        person,
        (await w.quiet.read(lobbySpaceCardVisible, person, link(w)))
          ? new Set(['alice'])
          : new Set()
      );
    }
    return { whereabouts: where, lobby: lobbies };
  },
});

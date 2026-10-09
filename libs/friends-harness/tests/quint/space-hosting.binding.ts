/**
 * `specs/spaces/space-hosting.qnt` against the friends composition (the
 * lowest one that composes spaces soundly — see
 * `tests/harness/open-friends-harness.ts`): each Quint action through the
 * spaces harness actions, and the model's state read back off each person's
 * screen.
 */

import { setupFriendsPair } from '@libs/friends-harness/setup-friends-pair';
import { partition, restoreNetwork } from '@libs/harness/actions';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { focusActor } from '@libs/harness/shell-actions';
import {
  closeSpaceMembers,
  createSpace,
  endSpace,
  joinFromLobby,
  joinFromPrompt,
  leaveSpace,
  openSpaceMembers,
  openSpacesTab,
  reenterActiveSpace,
  returnToLobby,
} from '@libs/spaces-harness/space-actions';
import type { SpaceScreen } from '@libs/spaces-harness/space-screen-read';
import { spaceScreenOf } from '@libs/spaces-harness/space-screen-read';
import {
  lobbyCardVisible,
  readSpaceLink,
  readSpacePresenceCount,
} from '@libs/spaces-harness/spaces-ui-reads';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import { variant } from '@pkgs/quint-shared/itf';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';
import orphanedPreview from './fixtures/space-link-preview-orphaned-after-leave.itf.json';

const PEOPLE = ['alice', 'bob'] as const;

function person(picks: Picks, name = 'person'): string {
  return String(picks[name]);
}

/** Space links, by the person who opened the space at that link. */
function hostKey(link: string): string {
  return `space-host:${link}`;
}

async function hostHere(
  w: QuintHarnessWorld,
  actorId: string
): Promise<string> {
  const link = await w.quiet.read(readSpaceLink, actorId);
  const host = link === null ? undefined : w.memo.get(hostKey(link));
  return typeof host === 'string' ? host : `unknown space ${String(link)}`;
}

async function whereaboutsHere(
  w: QuintHarnessWorld,
  actor: string,
  screen: SpaceScreen
): Promise<QuintValue> {
  if (screen === 'lobby') return variant('Lobby');
  if (screen === 'ended') return variant('Ended');
  const names = {
    space: 'InSpace',
    viewingPresence: 'ViewingPresence',
    left: 'Left',
    droppedOut: 'DroppedOut',
    elsewhere: 'Elsewhere',
  } as const;
  if (screen === 'elsewhere') return variant(names[screen]);
  return variant(names[screen], await hostHere(w, actor));
}

bindQuintModel<QuintHarnessWorld>({
  model: 'space-hosting',
  traces: 64,
  maxSteps: 32,
  inductiveInvariant: '_inductive',
  timeoutMs: 180_000,
  regressions: [
    {
      // regression: space-link-preview-orphaned-after-leave
      id: 'space-link-preview-orphaned-after-leave',
      title: 'A person can rejoin after leaving while the host was offline',
      seed: '0x67932',
      itf: orphanedPreview,
    },
  ],
  actions: {
    init: async (w) => {
      await setupFriendsPair(w.s, 'alice', 'bob');
      for (const actor of PEOPLE) await w.s.apply(openSpacesTab, actor);
    },
    createSpace: async (w, picks) => {
      const actor = person(picks);
      await w.s.apply(focusActor, actor);
      await w.s.apply(createSpace, actor);
      const link = await w.s.read(readSpaceLink, actor);
      if (link === null) throw new Error(`${actor} opened no space`);
      w.memo.set(hostKey(link), actor);
    },
    returnToSpace: async (w, picks) => {
      const actor = person(picks);
      await w.s.apply(focusActor, actor);
      await w.s.apply(reenterActiveSpace, actor, actor);
    },
    join: async (w, picks) => {
      const actor = person(picks);
      await w.s.apply(focusActor, actor);
      if ((await w.s.read(spaceScreenOf, actor)) === 'left') {
        await w.s.apply(joinFromPrompt, actor);
      } else {
        await w.s.apply(joinFromLobby, actor, person(picks, 'host'));
      }
    },
    stepOut: async (w, picks) => {
      await w.s.apply(returnToLobby, person(picks));
    },
    leave: async (w, picks) => {
      await w.s.apply(leaveSpace, person(picks));
    },
    viewPresence: async (w, picks) => {
      await w.s.apply(openSpaceMembers, person(picks));
    },
    stopViewingPresence: async (w, picks) => {
      await w.s.apply(closeSpaceMembers, person(picks));
    },
    endSpace: async (w, picks) => {
      const actor = person(picks);
      await w.s.apply(focusActor, actor);
      await w.s.apply(endSpace, actor);
    },
    goBackToLobby: async (w, picks) => {
      await w.s.apply(openSpacesTab, person(picks));
    },
    loseConnection: async (w, picks) => {
      await w.s.apply(partition, person(picks));
      await w.s.advanceTime(2_000);
    },
    connectionReturns: async (w) => {
      await w.s.apply(restoreNetwork);
      await w.s.advanceTime(2_000);
    },
  },
  observe: async (w) => {
    const whereabouts = new Map<QuintValue, QuintValue>();
    const lobby = new Map<QuintValue, QuintValue>();
    const presence = new Map<QuintValue, QuintValue>();
    for (const actor of PEOPLE) {
      lobby.set(actor, new Set());
      presence.set(actor, 0);
      const screen = await w.quiet.read(spaceScreenOf, actor);
      whereabouts.set(actor, await whereaboutsHere(w, actor, screen));
      if (screen === 'lobby') {
        const hosts = new Set<QuintValue>();
        for (const host of PEOPLE) {
          if (await w.quiet.read(lobbyCardVisible, actor, host))
            hosts.add(host);
        }
        lobby.set(actor, hosts);
      } else if (screen === 'viewingPresence') {
        presence.set(
          actor,
          (await w.quiet.read(readSpacePresenceCount, actor)) ?? -1
        );
      }
    }
    return { whereabouts, lobby, presence };
  },
});

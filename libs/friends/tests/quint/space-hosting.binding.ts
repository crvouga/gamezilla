/**
 * `specs/spaces/space-hosting.qnt` against the friends composition (the
 * lowest one that composes spaces soundly — see
 * `tests/e2e/support/open-friends-harness.ts`): each Quint action through the
 * spaces harness actions, and the model's state read back off each person's
 * screen.
 */

import { setupFriendsPair } from '@libs/friends/harness/setup-friends-pair';
import { focusActor } from '@libs/harness';
import type { QuintHarnessWorld } from '@libs/harness/quint/world';
import type { ProductHarness } from '@libs/harness/system/harness';
import { bringToFront, visible } from '@libs/harness/system/observations';
import {
  closeSpaceMembers,
  createSpace,
  endSpace,
  joinFromLobby,
  leaveSpace,
  openSpaceMembers,
  openSpacesTab,
  reenterActiveSpace,
  returnToLobby,
} from '@libs/spaces/harness/space-actions';
import {
  lobbyCardVisible,
  readSpaceLink,
  readSpacePresenceCount,
} from '@libs/spaces/harness/spaces-ui-reads';
import { Handles } from '@libs/test-ids';
import { type QuintValue, variant } from '@pkgs/quint/itf';
import { bindQuintModel, type Picks } from '@pkgs/quint/registry';

const PEOPLE = ['alice', 'bob'] as const;

function person(picks: Picks, name = 'person'): string {
  return String(picks[name]);
}

/** Space links, by the person who opened the space at that link. */
function hostKey(link: string): string {
  return `space-host:${link}`;
}

type Screen = 'ended' | 'viewingPresence' | 'space' | 'lobby' | 'elsewhere';

async function screenOf(s: ProductHarness, actorId: string): Promise<Screen> {
  await bringToFront(s, actorId);
  if (await visible(s, actorId, [Handles.spaceEnded])) return 'ended';
  if (await visible(s, actorId, [Handles.spaceMembersClose]))
    return 'viewingPresence';
  if (await visible(s, actorId, [Handles.spaceClose])) return 'space';
  if (await visible(s, actorId, [Handles.spaceCreate])) return 'lobby';
  return 'elsewhere';
}

async function hostHere(
  w: QuintHarnessWorld,
  actorId: string
): Promise<string> {
  const link = await w.quiet.read(readSpaceLink, actorId);
  const host = link === null ? undefined : w.memo.get(hostKey(link));
  return typeof host === 'string' ? host : `unknown space ${String(link)}`;
}

bindQuintModel<QuintHarnessWorld>({
  model: 'space-hosting',
  traces: 8,
  maxSteps: 10,
  timeoutMs: 180_000,
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
      await w.s.apply(joinFromLobby, actor, person(picks, 'host'));
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
  },
  observe: async (w) => {
    const whereabouts = new Map<QuintValue, QuintValue>();
    const lobby = new Map<QuintValue, QuintValue>();
    const presence = new Map<QuintValue, QuintValue>();
    for (const actor of PEOPLE) {
      const screen = await w.quiet.read(screenOf, actor);
      if (screen === 'lobby') {
        whereabouts.set(actor, variant('Lobby'));
        const hosts = new Set<QuintValue>();
        for (const host of PEOPLE) {
          if (await w.quiet.read(lobbyCardVisible, actor, host))
            hosts.add(host);
        }
        lobby.set(actor, hosts);
      } else if (screen === 'space') {
        whereabouts.set(actor, variant('InSpace', await hostHere(w, actor)));
      } else if (screen === 'viewingPresence') {
        whereabouts.set(
          actor,
          variant('ViewingPresence', await hostHere(w, actor))
        );
        presence.set(
          actor,
          (await w.quiet.read(readSpacePresenceCount, actor)) ?? -1
        );
      } else if (screen === 'ended') {
        whereabouts.set(actor, variant('Ended'));
      } else {
        whereabouts.set(actor, variant('Elsewhere'));
      }
    }
    return { whereabouts, lobby, presence };
  },
});

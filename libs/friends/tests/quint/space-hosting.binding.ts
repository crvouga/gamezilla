/**
 * `specs/spaces/space-hosting.qnt` against the friends composition (the
 * lowest one that composes spaces soundly — see
 * `tests/e2e/support/open-friends-sim.ts`): each Quint action through the
 * spaces sim actions, and the model's state read back off each person's
 * screen.
 */

import { setupFriendsPair } from '@libs/friends/sim/setup-friends-pair';
import { focusActor } from '@libs/sim-harness';
import type { QuintSimWorld } from '@libs/sim-harness/quint/world';
import { bringToFront, visible } from '@libs/sim-harness/system/observations';
import type { ProductSim } from '@libs/sim-harness/system/sim';
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
} from '@libs/spaces/sim/space-actions';
import {
  lobbyCardVisible,
  readSpaceLink,
  readSpacePresenceCount,
} from '@libs/spaces/sim/spaces-ui-reads';
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

type Screen = 'ended' | 'members' | 'space' | 'lobby' | 'elsewhere';

async function screenOf(s: ProductSim, actorId: string): Promise<Screen> {
  await bringToFront(s, actorId);
  if (await visible(s, actorId, [Handles.spaceEnded])) return 'ended';
  if (await visible(s, actorId, [Handles.spaceMembersClose])) return 'members';
  if (await visible(s, actorId, [Handles.spaceClose])) return 'space';
  if (await visible(s, actorId, [Handles.spaceCreate])) return 'lobby';
  return 'elsewhere';
}

async function hostHere(w: QuintSimWorld, actorId: string): Promise<string> {
  const link = await w.quiet.read(readSpaceLink, actorId);
  const host = link === null ? undefined : w.memo.get(hostKey(link));
  return typeof host === 'string' ? host : `unknown space ${String(link)}`;
}

bindQuintModel<QuintSimWorld>({
  model: 'space-hosting',
  traces: 8,
  maxSteps: 10,
  actions: {
    init: async (w) => {
      await setupFriendsPair(w.s, 'alice', 'bob');
      for (const actor of PEOPLE) await w.s.apply(openSpacesTab, actor);
    },
    create: async (w, picks) => {
      const actor = person(picks);
      await w.s.apply(focusActor, actor);
      await w.s.apply(createSpace, actor);
      const link = await w.s.read(readSpaceLink, actor);
      if (link === null) throw new Error(`${actor} opened no space`);
      w.memo.set(hostKey(link), actor);
    },
    reopen: async (w, picks) => {
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
    openMembers: async (w, picks) => {
      await w.s.apply(openSpaceMembers, person(picks));
    },
    closeMembers: async (w, picks) => {
      await w.s.apply(closeSpaceMembers, person(picks));
    },
    end: async (w, picks) => {
      const actor = person(picks);
      await w.s.apply(focusActor, actor);
      await w.s.apply(endSpace, actor);
    },
    backToLobby: async (w, picks) => {
      await w.s.apply(openSpacesTab, person(picks));
    },
  },
  observe: async (w) => {
    const place = new Map<QuintValue, QuintValue>();
    const listed = new Map<QuintValue, QuintValue>();
    const present = new Map<QuintValue, QuintValue>();
    for (const actor of PEOPLE) {
      const screen = await w.quiet.read(screenOf, actor);
      if (screen === 'lobby') {
        place.set(actor, variant('Lobby'));
        const hosts = new Set<QuintValue>();
        for (const host of PEOPLE) {
          if (await w.quiet.read(lobbyCardVisible, actor, host))
            hosts.add(host);
        }
        listed.set(actor, hosts);
      } else if (screen === 'space') {
        place.set(actor, variant('InSpace', await hostHere(w, actor)));
      } else if (screen === 'members') {
        place.set(actor, variant('Members', await hostHere(w, actor)));
        present.set(
          actor,
          (await w.quiet.read(readSpacePresenceCount, actor)) ?? -1
        );
      } else if (screen === 'ended') {
        place.set(actor, variant('Ended'));
      } else {
        place.set(actor, variant('Elsewhere'));
      }
    }
    return { place, listed, present };
  },
});

/**
 * `specs/runtime/app-platform.qnt` against the full production composition:
 * people opening the app, moving between tabs and Settings, signing in,
 * searching for each other and hosting spaces, while they are cut off and
 * reconnect and the machines the app runs on come and go (`_capacity`,
 * `_gainCapacity`, `_loseCapacity`, `_cutOffOnTheWay`). Every step also
 * checks the composition's standing properties (no error boundary, the global
 * menu reachable, search never hangs, …). The model's state is read back off
 * each person's place in the app, their account and the app's capacity.
 */

import { partition, restoreNetwork, spawnActor } from '@libs/harness/actions';
import { returnToTabs, signInWithGoogle } from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';
import { signedInAccountOf } from '@libs/harness/identity';
import {
  actorIds,
  bringToFront,
  serverIds as capacityParts,
  partitioned,
  visible,
} from '@libs/harness/observations';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import {
  partitionLoadBalancer as cutOffOnTheWay,
  spawnServerNode as gainCapacityPart,
  dropServerNode as loseCapacityPart,
} from '@libs/harness/server-actions';
import {
  backToTabs,
  focusActor,
  openSettings,
  openTab,
} from '@libs/harness/shell-actions';
import { onScreen } from '@libs/harness/ui-reads';
import { searchUsername } from '@libs/search-harness/search-actions';
import { createSpace, endSpace } from '@libs/spaces-harness/space-actions';
import { openSpaceHosts } from '@libs/spaces-harness/space-state-reads';
import { Handles } from '@libs/test-ids-shared/handles';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import { variant } from '@pkgs/quint-shared/itf';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

const PEOPLE = ['alice', 'bob', 'carol'] as const;

/** The model's tabs, by their tab-bar handle and their screen's `data-screen`. */
const TABS = {
  spaces: { handle: Handles.tabSpaces, screen: 'spaces' },
  notifications: { handle: Handles.tabNotifications, screen: 'notifications' },
  profile: { handle: Handles.tabProfile, screen: 'profile' },
} as const;

type Tab = keyof typeof TABS;

function isTab(value: string): value is Tab {
  return value in TABS;
}

function pick(picks: Picks, name: string): string {
  return String(picks[name]);
}

type Place = 'Ended' | 'InSpace' | 'Settings' | 'Search' | Tab | 'Elsewhere';

/** The actor's place in the app, most specific first (stack screens keep the tab below mounted). */
async function placeOf(s: ProductHarness, actorId: string): Promise<Place> {
  await bringToFront(s, actorId);
  if (await visible(s, actorId, [Handles.spaceEnded])) return 'Ended';
  if (await visible(s, actorId, [Handles.spaceClose])) return 'InSpace';
  if (await onScreen(s, actorId, 'more')) return 'Settings';
  if (await visible(s, actorId, [Handles.searchInput])) return 'Search';
  for (const [tab, { screen }] of Object.entries(TABS)) {
    if (isTab(tab) && (await onScreen(s, actorId, screen))) return tab;
  }
  return 'Elsewhere';
}

async function lookupOf(
  s: ProductHarness,
  actorId: string
): Promise<QuintValue> {
  if (await visible(s, actorId, [Handles.searchDenied])) {
    return variant('Denied');
  }
  if (await visible(s, actorId, [Handles.searchEmpty])) {
    return variant('Nobody');
  }
  const shown: string[] = [];
  for (const other of PEOPLE) {
    if (await visible(s, actorId, [Handles.searchUserResult(other)])) {
      shown.push(other);
    }
  }
  return shown.length === 1 && shown[0] !== undefined
    ? variant('Shows', shown[0])
    : variant('Unsettled', shown.join(','));
}

bindQuintModel<QuintHarnessWorld>({
  model: 'app-platform',
  // Apalache: 2 steps in about 12 s, 3 in about 160 s; 4 exceed 20 minutes.
  verifySteps: 2,
  traces: 10,
  maxSteps: 14,
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      await w.s.apply(spawnActor, 'alice');
      await w.s.apply(signInWithGoogle, 'alice');
      await w.s.apply(returnToTabs, 'alice');
      await w.s.apply(spawnActor, 'bob');
    },
    open: async (w, picks) => {
      await w.s.apply(spawnActor, pick(picks, 'person'));
    },
    openTab: async (w, picks) => {
      const actor = pick(picks, 'person');
      const tab = pick(picks, 'tab');
      if (!isTab(tab)) throw new Error(`unknown tab ${tab}`);
      await w.s.apply(focusActor, actor);
      await w.s.apply(openTab, actor, TABS[tab].handle);
    },
    openSettings: async (w, picks) => {
      const actor = pick(picks, 'person');
      await w.s.apply(focusActor, actor);
      await w.s.apply(openSettings, actor);
    },
    leaveSettings: async (w, picks) => {
      const actor = pick(picks, 'person');
      await w.s.apply(focusActor, actor);
      await w.s.apply(returnToTabs, actor);
    },
    signIn: async (w, picks) => {
      const actor = pick(picks, 'person');
      await w.s.apply(focusActor, actor);
      await w.s.apply(signInWithGoogle, actor);
      await w.s.apply(returnToTabs, actor);
    },
    lookUp: async (w, picks) => {
      const actor = pick(picks, 'person');
      await w.s.apply(focusActor, actor);
      await w.s.apply(backToTabs, actor);
      await w.s.apply(searchUsername, actor, pick(picks, 'other'));
    },
    host: async (w, picks) => {
      const actor = pick(picks, 'person');
      await w.s.apply(focusActor, actor);
      await w.s.apply(createSpace, actor);
    },
    end: async (w, picks) => {
      const actor = pick(picks, 'person');
      await w.s.apply(focusActor, actor);
      await w.s.apply(endSpace, actor);
    },
    cutOff: async (w, picks) => {
      await w.s.apply(partition, pick(picks, 'person'));
    },
    _cutOffOnTheWay: async (w, picks) => {
      await w.s.apply(cutOffOnTheWay, pick(picks, 'person'));
    },
    reconnect: async (w) => {
      await w.s.apply(restoreNetwork);
    },
    _gainCapacity: async (w) => {
      await w.s.apply(gainCapacityPart);
    },
    _loseCapacity: async (w, picks) => {
      const parts = await w.s.read(capacityParts);
      const part = parts[Number(picks['part'])];
      if (part === undefined)
        throw new Error(`no capacity part #${String(picks['part'])}`);
      await w.s.apply(loseCapacityPart, part);
    },
  },
  observe: async (w) => {
    const opened = new Set<QuintValue>(await w.quiet.read(actorIds));
    const place = new Map<QuintValue, QuintValue>();
    const lookup = new Map<QuintValue, QuintValue>();
    const signedIn = new Set<QuintValue>();
    for (const actor of PEOPLE) {
      if (!opened.has(actor)) continue;
      const at = await w.quiet.read(placeOf, actor);
      place.set(actor, isTab(at) ? variant('OnTab', at) : variant(at));
      if (at === 'Search') {
        lookup.set(actor, await w.quiet.read(lookupOf, actor));
      }
      if ((await w.quiet.read(signedInAccountOf, actor)) !== null) {
        signedIn.add(actor);
      }
    }
    const _capacity = (await w.quiet.read(capacityParts)).length;
    return {
      opened,
      place,
      signedIn,
      lookup,
      _capacity,
      hosting: await w.quiet.read(openSpaceHosts, PEOPLE),
      offline: new Set(
        (await w.quiet.read(partitioned))
          .flatMap((pair) => pair.split('|'))
          .filter((actor) => PEOPLE.some((person) => person === actor))
      ),
    };
  },
});

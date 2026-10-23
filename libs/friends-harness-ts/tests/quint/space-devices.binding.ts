import {
  openBilling,
  subscribeToPlus,
} from '@libs/billing-harness-ts/billing-actions';
import { billingTier } from '@libs/billing-harness-ts/billing-reads';
import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import {
  returnToTabs,
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { otherDevice } from '@libs/harness-ts/platform';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import { profileIdOf } from '@libs/profile-harness-ts/profile-ui-reads';
import {
  closeSpaceMembers,
  joinViaLink,
  openSpaceMembers,
  returnToLobby,
  startSpace,
} from '@libs/spaces-harness-ts/space-actions';
import { shownSpaceDevices } from '@libs/spaces-harness-ts/space-devices-seen';
import { stayIdle } from '@libs/spaces-harness-ts/space-idle-actions';
import { ownActivityAt } from '@libs/spaces-harness-ts/space-idle-reads';
import { spaceScreenOf } from '@libs/spaces-harness-ts/space-screen-read';
import {
  activeSpaceVisible,
  readSpaceLink,
} from '@libs/spaces-harness-ts/spaces-ui-reads';
import type { QuintValue } from '@pkgs/quint-shared-ts/itf';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import connectedHost from './fixtures/space-join-chooses-connected-host-device.itf.json';

const LINKS = 'space-device-links';
const ALICE_DEVICES = ['alice', 'alice_phone'] as const;
const DEVICES = ['alice', 'alice_phone', 'bob', 'bob_phone'] as const;

const ACTOR_OF: Record<string, string> = {
  'alice-phone': 'alice',
  'alice-computer': 'alice_phone',
  'bob-phone': 'bob',
  'bob-computer': 'bob_phone',
};

function actorOf(device: string): string {
  const actor = ACTOR_OF[device];
  if (actor === undefined) throw new Error(`Unknown device ${device}`);
  return actor;
}

function linksOf(w: QuintHarnessWorld): Map<string, string> {
  const found = w.memo.get(LINKS);
  return found instanceof Map ? (found as Map<string, string>) : new Map();
}

function rememberLink(w: QuintHarnessWorld, actor: string, link: string): void {
  const next = new Map(linksOf(w));
  next.set(actor, link);
  w.memo.set(LINKS, next);
}

function deviceOffline(s: ProductHarness, actor: string): boolean {
  return s.session.network
    .partitions()
    .some((pair) => pair[0] === actor || pair[1] === actor);
}

async function waitActivity(
  w: QuintHarnessWorld,
  actor: string
): Promise<void> {
  // An offline device has no room stamp yet. Quiet time cannot start until
  // its connection is back, which waits for the stamp itself.
  if (await w.s.read((s) => deviceOffline(s, actor))) return;
  await w.s.until((s) => ownActivityAt(s, actor), {
    pred: (at) => at !== null,
    maxMs: 20_000,
  });
}

async function signDevicePair(
  w: QuintHarnessWorld,
  primary: Actor
): Promise<void> {
  await w.s.apply(signInWithGoogle, primary);
  await w.s.apply(returnToTabs, primary);
  const phone = otherDevice(primary);
  await w.s.apply(signInWithGoogleAsAccount, phone, primary);
  await w.s.apply(returnToTabs, phone);
}

async function grantPlus(w: QuintHarnessWorld): Promise<void> {
  const phone = otherDevice('alice');
  await w.s.apply(openBilling, 'alice');
  await w.s.apply(subscribeToPlus, 'alice');
  await w.s.apply(backToTabs, 'alice');
  await w.s.apply(openBilling, phone);
  await w.s.until((s) => billingTier(s, phone), {
    pred: (tier) => tier === 'paid',
    maxMs: 20_000,
  });
  await w.s.apply(backToTabs, phone);
}

async function linkToEnter(
  w: QuintHarnessWorld,
  actor: string
): Promise<string> {
  const own = linksOf(w).get(actor);
  if (own !== undefined) return own;
  for (const host of ALICE_DEVICES) {
    const shown = await w.s.read(readSpaceLink, host);
    if (shown !== null) return shown;
  }
  const remembered = linksOf(w).values().next().value;
  if (typeof remembered !== 'string')
    throw new Error(`${actor} knows no space`);
  return remembered;
}

async function connectedHostLink(w: QuintHarnessWorld): Promise<string> {
  for (const host of ALICE_DEVICES) {
    if (await w.s.read((s) => deviceOffline(s, host))) continue;
    const link = linksOf(w).get(host) ?? (await w.s.read(readSpaceLink, host));
    if (link !== undefined && link !== null) return link;
  }
  throw new Error('No connected host has shared a space link');
}

function counted(seenIds: ReadonlySet<string>, memberId: string): number {
  return memberId.length > 0 && seenIds.has(memberId) ? 1 : 0;
}

bindQuintModel<QuintHarnessWorld>({
  model: 'space-devices',
  traces: 12,
  maxSteps: 8,
  verifySteps: 2,
  timeoutMs: 180_000,
  regressions: [
    {
      // regression: space-join-chooses-connected-host-device
      id: 'space-join-chooses-connected-host-device',
      title: 'Joining chooses the connected host device’s space',
      seed: '0x67932',
      itf: connectedHost,
    },
  ],
  actions: {
    init: async (w, picks) => {
      await signDevicePair(w, 'alice');
      await signDevicePair(w, 'bob');
      if (picks['paid'] === true) await grantPlus(w);
    },
    createSpace: async (w, picks) => {
      const actor = actorOf(String(picks['device']));
      await w.s.apply(startSpace, actor);
      const link = await w.s.read(readSpaceLink, actor);
      if (link === null) return;
      rememberLink(w, actor, link);
      await waitActivity(w, actor);
    },
    returnToSpace: async (w, picks) => {
      const actor = actorOf(String(picks['device']));
      await w.s.apply(joinViaLink, actor, await linkToEnter(w, actor));
      await waitActivity(w, actor);
    },
    join: async (w, picks) => {
      const actor = actorOf(String(picks['device']));
      await w.s.apply(joinViaLink, actor, await connectedHostLink(w));
      await waitActivity(w, actor);
    },
    viewPresence: async (w, picks) => {
      const actor = actorOf(String(picks['device']));
      await w.s.apply(openSpaceMembers, actor);
      await w.s.apply(closeSpaceMembers, actor);
    },
    goQuiet: async (w, picks) => {
      const minutes = Number(picks['minutes']);
      if (minutes < 2) return;
      await w.s.apply(stayIdle, actorOf(String(picks['device'])), minutes);
    },
    loseConnection: async (w, picks) => {
      await w.s.apply(partition, actorOf(String(picks['device'])));
      await w.s.advanceTime(2_000);
    },
    connectionReturns: async (w, picks) => {
      const actor = actorOf(String(picks['device']));
      await w.s.apply(restoreActorConnection, actor);
      await w.s.advanceTime(2_000);
      if (await w.s.read(activeSpaceVisible, actor))
        await waitActivity(w, actor);
    },
    closeApp: async (w, picks) => {
      const actor = actorOf(String(picks['device']));
      if ((await w.s.read(spaceScreenOf, actor)) === 'viewingPresence') {
        await w.s.apply(closeSpaceMembers, actor);
      }
      await w.s.apply(returnToLobby, actor);
    },
  },
  observe: async (w) => {
    const seen = await w.quiet.read(shownSpaceDevices, DEVICES, ALICE_DEVICES);
    const alice = (await w.quiet.read(profileIdOf, 'alice')) ?? '';
    const bob = (await w.quiet.read(profileIdOf, 'bob')) ?? '';
    const presence = new Map<QuintValue, QuintValue>([
      ['alice', counted(seen.counted, alice)],
      ['bob', counted(seen.counted, bob)],
    ]);
    const idle = new Map<QuintValue, QuintValue>([
      ['alice', alice.length > 0 && seen.idle.has(alice)],
      ['bob', bob.length > 0 && seen.idle.has(bob)],
    ]);
    return {
      presence,
      idle,
      hostedSpaces: seen.hostedIds.size,
      invitedToPlus: seen.invitedToPlus,
    };
  },
});

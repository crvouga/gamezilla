import {
  openBilling,
  subscribeToPlus,
} from '@libs/billing-harness/billing-actions';
import { prepareNamedFriend } from '@libs/friends-harness/setup-friend-request';
import { partition, restoreActorConnection } from '@libs/harness/actions';
import {
  returnToTabs,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';
import { partitioned, visible } from '@libs/harness/observations';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import { profileIdOf } from '@libs/profile-harness/profile-ui-reads';
import {
  closeSpaceMembers,
  closeSpaceScreen,
  joinViaLink,
  openSpaceMembers,
  startSpace,
  stayQuiet,
  tryReturnToOwnSpace,
} from '@libs/spaces-harness/space-actions';
import {
  hostedSpaceIds,
  presenceIdle,
  presencePeople,
} from '@libs/spaces-harness/space-device-reads';
import {
  hostingLimitShown,
  readSpaceLink,
} from '@libs/spaces-harness/spaces-ui-reads';
import { Handles } from '@libs/test-ids-shared/handles';
import type { Picks } from '@pkgs/quint-shared/registry';
import { bindQuintModel } from '@pkgs/quint-shared/registry';

const DEVICE_ACTOR = {
  'alice-phone': 'alice',
  'alice-computer': 'alice_phone',
  'bob-phone': 'bob',
  'bob-computer': 'bob_phone',
} as const;

const ALICE_DEVICES = ['alice', 'alice_phone'] as const;
const PEOPLE = ['alice', 'bob'] as const;

function deviceActor(picks: Picks): string {
  const name = String(picks['device']);
  const actor = DEVICE_ACTOR[name as keyof typeof DEVICE_ACTOR];
  if (actor === undefined) throw new Error(`Unknown device ${name}`);
  return actor;
}

function paidPick(picks: Picks): boolean {
  const paid = picks['paid'];
  return paid === true || paid === 'true';
}

async function unionLines(
  w: QuintHarnessWorld,
  actors: readonly string[],
  read: typeof presencePeople
): Promise<Set<string>> {
  const found = new Set<string>();
  for (const actor of actors) {
    if (!(await w.quiet.read((s) => s.actors.has(actor)))) continue;
    for (const id of await w.quiet.read(read, actor)) found.add(id);
  }
  return found;
}

async function personFlags(
  w: QuintHarnessWorld,
  people: ReadonlySet<string>,
  idleIds: ReadonlySet<string>
): Promise<{
  readonly presence: Map<string, number>;
  readonly idle: Map<string, boolean>;
}> {
  const presence = new Map<string, number>();
  const idle = new Map<string, boolean>();
  for (const person of PEOPLE) {
    const id = await w.quiet.read(profileIdOf, person);
    presence.set(person, id !== null && people.has(id) ? 1 : 0);
    idle.set(person, id !== null && idleIds.has(id));
  }
  return { presence, idle };
}

async function plusInvited(w: QuintHarnessWorld): Promise<boolean> {
  for (const actor of ALICE_DEVICES) {
    if (!(await w.quiet.read((s) => s.actors.has(actor)))) continue;
    if (await w.quiet.read(hostingLimitShown, actor)) return true;
  }
  return false;
}

function actorIsOffline(s: ProductHarness, actorId: string): boolean {
  return partitioned(s).some((pair) => pair.split('|').includes(actorId));
}

/** A space this device is showing, or the earliest one it still hosts. */
async function linkFrom(
  w: QuintHarnessWorld,
  actor: string
): Promise<string | null> {
  const path = await w.s.read(readSpaceLink, actor);
  if (path !== null) return path;
  const id = (await w.s.read(hostedSpaceIds, actor))[0];
  return id === undefined ? null : `/space/${id}`;
}

/**
 * The space a guest can join while the host still has a connection.
 * A device that is offline may still be standing in a space the other
 * device created; that link is not the one the host is up for.
 */
async function aliceLink(w: QuintHarnessWorld): Promise<string> {
  const online: string[] = [];
  const offline: string[] = [];
  for (const actor of ALICE_DEVICES) {
    if (!(await w.s.read((s) => s.actors.has(actor)))) continue;
    if (await w.s.read(actorIsOffline, actor)) offline.push(actor);
    else online.push(actor);
  }
  for (const actor of [...online, ...offline]) {
    const link = await linkFrom(w, actor);
    if (link !== null) return link;
  }
  throw new Error('Alice has no space link');
}

bindQuintModel<QuintHarnessWorld>({
  model: 'space-devices',
  traces: 32,
  maxSteps: 24,
  actions: {
    init: async (w, picks) => {
      await prepareNamedFriend(w.s, 'alice');
      if (paidPick(picks)) {
        await w.s.apply(openBilling, 'alice');
        await w.s.apply(subscribeToPlus, 'alice');
        await w.s.apply(returnToTabs, 'alice');
      }
      await w.s.apply(signInWithGoogleAsAccount, 'alice_phone', 'alice');
      await w.s.apply(returnToTabs, 'alice_phone');
      await prepareNamedFriend(w.s, 'bob');
      await w.s.apply(signInWithGoogleAsAccount, 'bob_phone', 'bob');
      await w.s.apply(returnToTabs, 'bob_phone');
    },
    createSpace: (w, picks) => w.s.apply(startSpace, deviceActor(picks)),
    returnToSpace: (w, picks) =>
      w.s.apply(tryReturnToOwnSpace, deviceActor(picks)),
    join: async (w, picks) => {
      await w.s.apply(joinViaLink, deviceActor(picks), await aliceLink(w));
    },
    viewPresence: (w, picks) => w.s.apply(openSpaceMembers, deviceActor(picks)),
    goQuiet: (w, picks) =>
      w.s.apply(stayQuiet, deviceActor(picks), Number(picks['minutes'])),
    loseConnection: async (w, picks) => {
      await w.s.apply(partition, deviceActor(picks));
      await w.s.advanceTime(2_000);
    },
    connectionReturns: async (w, picks) => {
      await w.s.apply(restoreActorConnection, deviceActor(picks));
      await w.s.advanceTime(2_000);
    },
    closeApp: async (w, picks) => {
      const actor = deviceActor(picks);
      if (await w.s.read(visible, actor, [Handles.spaceMembersClose]))
        await w.s.apply(closeSpaceMembers, actor);
      await w.s.apply(closeSpaceScreen, actor);
    },
  },
  observe: async (w) => {
    const devices = Object.values(DEVICE_ACTOR);
    const people = await unionLines(w, devices, presencePeople);
    const idleIds = await unionLines(w, devices, presenceIdle);
    const hosted = await unionLines(w, ALICE_DEVICES, hostedSpaceIds);
    const flags = await personFlags(w, people, idleIds);
    return {
      presence: flags.presence,
      idle: flags.idle,
      hostedSpaces: hosted.size,
      invitedToPlus: await plusInvited(w),
    };
  },
});

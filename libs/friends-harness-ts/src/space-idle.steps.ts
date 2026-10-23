import { expect } from 'bun:test';
import { restoreNetwork } from '@libs/harness-ts/actions';
import {
  returnToTabs,
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness-ts/auth-actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { cutConnection, otherDevice } from '@libs/harness-ts/platform';
import { focusActor } from '@libs/harness-ts/shell-actions';
import { type HarnessWorld, remember } from '@libs/harness-ts/spec-world';
import { profileIdOf } from '@libs/profile-harness-ts/profile-ui-reads';
import {
  createSpace,
  joinViaLink,
  returnToLobby,
  startSpace,
} from '@libs/spaces-harness-ts/space-actions';
import { stayIdle } from '@libs/spaces-harness-ts/space-idle-actions';
import {
  ownActivityAt,
  personIdleShown,
  personPresenceCount,
} from '@libs/spaces-harness-ts/space-idle-reads';
import { spaceScreenOf } from '@libs/spaces-harness-ts/space-screen-read';
import {
  activeSpaceVisible,
  readSpaceLink,
  spaceEndedShown,
} from '@libs/spaces-harness-ts/spaces-ui-reads';
import { rememberedSpaceLink } from './spaces.steps';

async function memberOf(w: HarnessWorld, actor: Actor): Promise<string> {
  const member = await w.s.read(profileIdOf, actor);
  if (member === null) throw new Error(`${actor} has no profile`);
  return member;
}

async function ensureSignedIn(w: HarnessWorld, actor: Actor): Promise<void> {
  if ((await w.s.read(signedInAccountOf, actor)) !== null) return;
  const link = await w.s.read(readSpaceLink, actor);
  await w.s.apply(signInWithGoogle, actor);
  if (link !== null && !(await w.s.read(activeSpaceVisible, actor))) {
    await w.s.apply(joinViaLink, actor, link);
  }
}

async function ensureOtherDevice(w: HarnessWorld, actor: Actor): Promise<void> {
  const device = otherDevice(actor);
  const account = await w.s.read(signedInAccountOf, actor);
  const otherAccount = await w.s.read(signedInAccountOf, device);
  if (account !== null && account === otherAccount) return;
  await w.s.apply(signInWithGoogleAsAccount, device, actor);
  await w.s.apply(returnToTabs, device);
}

/** Put `actor`'s other device, signed in to their account, in their space. */
export async function putOtherDeviceInSpace(
  w: HarnessWorld,
  actor: Actor
): Promise<void> {
  await ensureSignedIn(w, actor);
  await ensureOtherDevice(w, actor);
  const link = await w.s.read(readSpaceLink, actor);
  if (link === null) throw new Error(`${actor} is not in a space`);
  const device = otherDevice(actor);
  await w.s.apply(joinViaLink, device, link);
  // Joining is something they did. Wait until that arrival is recorded,
  // before any later quiet time, or the stamp lands during the quiet wait.
  await w.s.until((s) => ownActivityAt(s, device), {
    pred: (at) => at !== null,
    maxMs: 20_000,
  });
}

When(
  '{actor} stays idle for {int} minute(s)',
  async (w, actor: Actor, minutes: number) => {
    await w.s.apply(stayIdle, actor, minutes);
  }
);

When(
  "{actor}'s phone stays idle for {int} minute(s)",
  async (w, actor: Actor, minutes: number) => {
    await w.s.apply(stayIdle, actor, minutes);
  }
);

When(
  "{actor}'s other device stays idle for {int} minute(s)",
  async (w, actor: Actor, minutes: number) => {
    await w.s.apply(stayIdle, otherDevice(actor), minutes);
  }
);

Given(
  '{actor} has been idle for {int} minute(s)',
  async (w, actor: Actor, minutes: number) => {
    await w.s.apply(stayIdle, actor, minutes);
  }
);

Then(
  '{actor} sees {actor} is idle within {int} seconds',
  async (w, actor: Actor, person: Actor, seconds: number) => {
    const member = await memberOf(w, person);
    await w.s.until((s) => personIdleShown(s, actor, member), {
      maxMs: seconds * 1_000,
    });
  }
);

Then(
  '{actor} sees {actor} is not idle within {int} seconds',
  async (w, actor: Actor, person: Actor, seconds: number) => {
    const member = await memberOf(w, person);
    await w.s.until((s) => personIdleShown(s, actor, member), {
      pred: (idle) => !idle,
      maxMs: seconds * 1_000,
    });
  }
);

Then('{actor} is not idle', async (w, actor: Actor) => {
  const member = await memberOf(w, actor);
  await w.s.until((s) => personIdleShown(s, actor, member), {
    pred: (idle) => !idle,
    maxMs: 15_000,
  });
});

Then(
  '{actor} does not see they have left the space',
  async (w, actor: Actor) => {
    expect(await w.s.read(spaceScreenOf, actor)).not.toBe('left');
  }
);

Given('{actor} has lost the connection', async (w, actor: Actor) => {
  await cutConnection(w, actor);
});

Given(
  '{actor} has lost the connection and the connection has come back',
  async (w, actor: Actor) => {
    await cutConnection(w, actor);
    await w.s.apply(restoreNetwork);
  }
);

Given(
  "{actor}'s phone and her other device are in the space",
  async (w, actor: Actor) => {
    await putOtherDeviceInSpace(w, actor);
    expect(await w.s.read(activeSpaceVisible, actor)).toBe(true);
    expect(await w.s.read(activeSpaceVisible, otherDevice(actor))).toBe(true);
  }
);

export function otherDevicePlacedKey(actor: Actor): string {
  return `otherDevicePlaced:${actor}`;
}

When(
  '{actor} returns to their space on another device',
  async (w, actor: Actor) => {
    await putOtherDeviceInSpace(w, actor);
    remember(w, otherDevicePlacedKey(actor), true);
  }
);

When(
  '{actor} creates another space on her other device',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, otherDevice(actor));
    await w.s.apply(startSpace, otherDevice(actor));
  }
);

When(
  "{actor}'s other device joins the space from the link",
  async (w, actor: Actor) => {
    await w.s.apply(joinViaLink, otherDevice(actor), rememberedSpaceLink(w));
  }
);

Given("{actor}'s other device is in the space", async (w, actor: Actor) => {
  // The same sentence is also the check that they stayed. Once this scenario
  // has placed them, a later use only reads that they are still there.
  if (w.memo.get(otherDevicePlacedKey(actor)) === true) {
    expect(await w.s.read(activeSpaceVisible, otherDevice(actor))).toBe(true);
    return;
  }
  await putOtherDeviceInSpace(w, actor);
  remember(w, otherDevicePlacedKey(actor), true);
  expect(await w.s.read(activeSpaceVisible, otherDevice(actor))).toBe(true);
});

Given(
  '{actor} is hosting a space that {actor} joined from the link and her phone has been idle for {int} minute(s)',
  async (w, host: Actor, guest: Actor, minutes: number) => {
    await w.s.apply(signInWithGoogle, host);
    await w.s.apply(focusActor, host);
    await w.s.apply(createSpace, host);
    const link = await w.s.read(readSpaceLink, host);
    if (link === null) throw new Error(`${host} is not in a space`);
    remember(w, 'spaceLink', link);
    await w.s.apply(joinViaLink, guest, link);
    await w.s.apply(stayIdle, host, minutes);
  }
);

Then(
  "{actor} sees {actor} once in the space's presence",
  async (w, actor: Actor, person: Actor) => {
    const member = await memberOf(w, person);
    await w.s.until((s) => personPresenceCount(s, actor, member), {
      pred: (count) => count === 1,
      maxMs: 20_000,
    });
  }
);

When('{actor} closes the app on her phone', async (w, actor: Actor) => {
  await w.s.apply(returnToLobby, actor);
});

When("{actor}'s phone loses the connection", async (w, actor: Actor) => {
  await cutConnection(w, actor);
});

Then("{actor}'s phone is in the space", async (w, actor: Actor) => {
  expect(await w.s.read(activeSpaceVisible, actor)).toBe(true);
});

Then('the space has not ended', async (w) => {
  const actors = await w.s.read((s) => [...s.actors.keys()]);
  for (const actor of actors) {
    expect(await w.s.read(spaceEndedShown, actor)).toBe(false);
  }
});

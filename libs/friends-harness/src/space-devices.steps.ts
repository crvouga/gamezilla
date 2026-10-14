import { expect } from 'bun:test';
import { restoreNetwork } from '@libs/harness/actions';
import {
  returnToTabs,
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import { Given, Step, Then, When } from '@libs/harness/define';
import { signedInAccountOf } from '@libs/harness/identity';
import { visible } from '@libs/harness/observations';
import type { Actor } from '@libs/harness/parameter-types';
import { cutConnection, otherDevice } from '@libs/harness/platform';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { remember } from '@libs/harness/spec-world';
import { profileIdOf } from '@libs/profile-harness/profile-ui-reads';
import {
  closeSpaceMembers,
  closeSpaceScreen,
  createSpace,
  joinViaLink,
  openSpaceMembers,
  returnToOwnSpace,
  startSpace,
  stayQuiet,
  tryReturnToOwnSpace,
} from '@libs/spaces-harness/space-actions';
import {
  connectionMissingShown,
  memberRowCount,
  presenceIdle,
} from '@libs/spaces-harness/space-device-reads';
import { spaceScreenOf } from '@libs/spaces-harness/space-screen-read';
import {
  activeSpaceVisible,
  readSpaceLink,
  spaceEndedShown,
} from '@libs/spaces-harness/spaces-ui-reads';
import { Handles } from '@libs/test-ids-shared/handles';
import { rememberedSpaceLink } from './spaces.steps';

const SECOND_MS = 1_000;
const ACTED = 'space-devices:acted';

function noteActed(w: HarnessWorld): void {
  w.memo.set(ACTED, true);
}

async function signInOther(w: HarnessWorld, actor: Actor): Promise<string> {
  const device = otherDevice(actor);
  const present = await w.s.read((s) => s.actors.has(device));
  if (!present || (await w.s.read(signedInAccountOf, device)) === null) {
    await w.s.apply(signInWithGoogleAsAccount, device, actor);
    await w.s.apply(returnToTabs, device);
  }
  return device;
}

async function putOtherInSpace(w: HarnessWorld, actor: Actor): Promise<void> {
  const device = await signInOther(w, actor);
  if (await w.s.read(activeSpaceVisible, device)) return;
  const link = await w.s.read(readSpaceLink, actor);
  if (link === null) throw new Error(`${actor} has no space to share`);
  await w.s.apply(joinViaLink, device, link);
}

async function profile(w: HarnessWorld, person: Actor): Promise<string> {
  const id = await w.s.read(profileIdOf, person);
  if (id === null) throw new Error(`${person} has no profile`);
  return id;
}

Given(
  "{actor}'s phone and her other device are in the space",
  async (w, actor: Actor) => {
    if (!(await w.s.read(activeSpaceVisible, actor)))
      await w.s.apply(returnToOwnSpace, actor);
    await putOtherInSpace(w, actor);
  }
);

Step("{actor}'s other device is in the space", async (w, actor: Actor) => {
  const device = otherDevice(actor);
  if (w.memo.get(ACTED) === true) {
    expect(await w.s.read(activeSpaceVisible, device)).toBe(true);
    return;
  }
  await putOtherInSpace(w, actor);
});

When(
  "{actor}'s other device returns to their space",
  async (w, actor: Actor) => {
    noteActed(w);
    await w.s.apply(tryReturnToOwnSpace, await signInOther(w, actor));
  }
);

When(
  '{actor} returns to their space on another device',
  async (w, actor: Actor) => {
    noteActed(w);
    await w.s.apply(returnToOwnSpace, await signInOther(w, actor));
  }
);

When(
  '{actor} creates another space on her other device',
  async (w, actor: Actor) => {
    noteActed(w);
    await w.s.apply(startSpace, await signInOther(w, actor));
  }
);

When(
  "{actor}'s other device joins the space from the link",
  async (w, actor: Actor) => {
    noteActed(w);
    const device = await signInOther(w, actor);
    await w.s.apply(joinViaLink, device, rememberedSpaceLink(w));
  }
);

When('{actor} closes the app on her phone', async (w, actor: Actor) => {
  noteActed(w);
  if (await w.s.read(visible, actor, [Handles.spaceMembersClose]))
    await w.s.apply(closeSpaceMembers, actor);
  await w.s.apply(closeSpaceScreen, actor);
});

When("{actor}'s phone loses the connection", async (w, actor: Actor) => {
  noteActed(w);
  await cutConnection(w, actor);
});

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
  '{actor} has been idle for {int} minute(s)',
  async (w, actor: Actor, minutes: number) => {
    await w.s.apply(stayQuiet, actor, minutes);
  }
);

Given(
  '{actor} is hosting a space that {actor} joined from the link and her phone has been idle for {int} minute(s)',
  async (w, host: Actor, guest: Actor, minutes: number) => {
    // Signed in before the quiet window, so adding the phone does not walk
    // the host through Google and clear the quiet mark they already hold.
    await w.s.apply(signInWithGoogle, host);
    await w.s.apply(createSpace, host);
    const link = await w.s.read(readSpaceLink, host);
    if (link === null) throw new Error(`${host} has no space`);
    remember(w, 'spaceLink', link);
    await w.s.apply(joinViaLink, guest, link);
    await w.s.apply(stayQuiet, host, minutes);
  }
);

When(
  '{actor} stays idle for {int} minute(s)',
  async (w, actor: Actor, minutes: number) => {
    noteActed(w);
    await w.s.apply(stayQuiet, actor, minutes);
  }
);

When(
  "{actor}'s phone stays idle for {int} minute(s)",
  async (w, actor: Actor, minutes: number) => {
    noteActed(w);
    await w.s.apply(stayQuiet, actor, minutes);
  }
);

When(
  "{actor}'s other device stays idle for {int} minute(s)",
  async (w, actor: Actor, minutes: number) => {
    noteActed(w);
    await w.s.apply(stayQuiet, otherDevice(actor), minutes);
  }
);

Then(
  '{actor} is told the connection is missing within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.until((s) => connectionMissingShown(s, actor), {
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then('{actor} is not idle', async (w, actor: Actor) => {
  const id = await profile(w, actor);
  expect(await w.s.read(presenceIdle, actor)).not.toContain(id);
});

Then(
  '{actor} sees {actor} is idle within {int} seconds',
  async (w, viewer: Actor, person: Actor, seconds: number) => {
    const id = await profile(w, person);
    await w.s.until((s) => presenceIdle(s, viewer), {
      pred: (idle) => idle.includes(id),
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  '{actor} sees {actor} is not idle within {int} seconds',
  async (w, viewer: Actor, person: Actor, seconds: number) => {
    const id = await profile(w, person);
    await w.s.until((s) => presenceIdle(s, viewer), {
      pred: (idle) => !idle.includes(id),
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  "{actor} sees {actor} once in the space's presence",
  async (w, viewer: Actor, person: Actor) => {
    const id = await profile(w, person);
    await w.s.apply(openSpaceMembers, viewer);
    expect(await w.s.read(memberRowCount, viewer, id)).toBe(1);
  }
);

Then(
  '{actor} does not see they have left the space',
  async (w, actor: Actor) => {
    expect(await w.s.read(spaceScreenOf, actor)).not.toBe('left');
  }
);

Then("{actor}'s phone is in the space", async (w, actor: Actor) => {
  expect(await w.s.read(activeSpaceVisible, actor)).toBe(true);
});

Then('the space has not ended', async (w) => {
  for (const actor of ['alice', otherDevice('alice'), 'bob']) {
    if (!(await w.s.read((s) => s.actors.has(actor)))) continue;
    expect(await w.s.read(spaceEndedShown, actor)).toBe(false);
  }
});

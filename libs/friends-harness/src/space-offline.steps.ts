import { expect } from 'bun:test';
import {
  openBilling,
  subscribeToPlus,
} from '@libs/billing-harness/billing-actions';
import {
  returnToTabs,
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { cutConnection, otherDevice } from '@libs/harness/platform';
import { focusActor } from '@libs/harness/shell-actions';
import { type HarnessWorld, recall, remember } from '@libs/harness/spec-world';
import { createSpace, openSpacesTab } from '@libs/spaces-harness/space-actions';
import {
  joinRetryOffered,
  otherDeviceInSameSpace,
  readSpaceLink,
  returnToSpaceOffered,
  spaceHostOfflineShown,
} from '@libs/spaces-harness/spaces-ui-reads';

export const OFFLINE_SPACE_LINK = 'offlineSpaceLink';

Then('{actor} can try joining again', async (w, actor: Actor) => {
  expect(await w.s.read(joinRetryOffered, actor)).toBe(true);
});

Given('{actor} is offline on a fresh device', async (w, actor: Actor) => {
  expect(await w.s.read((s) => s.actors.has(actor))).toBe(false);
  await cutConnection(w, actor);
});

Given('{actor} is hosting a space created offline', async (w, actor: Actor) => {
  await cutConnection(w, actor);
  await w.s.apply(createSpace, actor);
  const link = await w.s.read(readSpaceLink, actor);
  expect(link).not.toBeNull();
  remember(w, OFFLINE_SPACE_LINK, link);
});

Then('{actor} is in the same space', async (w, actor: Actor) => {
  expect(await w.s.read(readSpaceLink, actor)).toBe(
    recall(w, OFFLINE_SPACE_LINK) as string
  );
});

When(
  "{actor}'s other device returns to their space",
  async (w, actor: Actor) => {
    await w.s.apply(openSpacesTab, otherDevice(actor));
  }
);

Then(
  '{actor} is not offered to return to their space on her other device',
  async (w, actor: Actor) => {
    expect(await w.s.read(returnToSpaceOffered, otherDevice(actor))).toBe(
      false
    );
  }
);

Then("{actor}'s other device is in the same space", async (w, actor: Actor) => {
  await w.s.until((s) => otherDeviceInSameSpace(s, actor), {
    maxMs: 20_000,
  });
});

Then(
  "{actor}'s other device is in the space her phone created",
  async (w, actor: Actor) => {
    const created = recall(w, OFFLINE_SPACE_LINK) as string;
    await w.s.until((s) => readSpaceLink(s, otherDevice(actor)), {
      pred: (link) => link === created,
      maxMs: 20_000,
    });
  }
);

async function hostOfflineOnBothDevices(
  w: HarnessWorld,
  actor: Actor,
  plus: boolean
): Promise<void> {
  await w.s.apply(signInWithGoogle, actor);
  if (plus) {
    await w.s.apply(openBilling, actor);
    await w.s.apply(subscribeToPlus, actor);
  }
  await w.s.apply(signInWithGoogleAsAccount, otherDevice(actor), actor);
  await w.s.apply(returnToTabs, otherDevice(actor));
  await cutConnection(w, actor);
  await cutConnection(w, otherDevice(actor));
  await w.s.apply(createSpace, actor);
  const link = await w.s.read(readSpaceLink, actor);
  expect(link).not.toBeNull();
  remember(w, OFFLINE_SPACE_LINK, link);
  await w.s.advanceTime(1_000);
  await w.s.apply(createSpace, otherDevice(actor));
}

Given(
  '{actor} is hosting a space created offline on her phone and a later space created offline on her other device',
  async (w, actor: Actor) => {
    await hostOfflineOnBothDevices(w, actor, false);
  }
);

Given(
  '{actor} is a Plus member hosting a space created offline on her phone and a later space created offline on her other device',
  async (w, actor: Actor) => {
    await hostOfflineOnBothDevices(w, actor, true);
  }
);

Then(
  '{actor} is told the host is offline within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((surface) => spaceHostOfflineShown(surface, actor), {
      maxMs: seconds * 1_000,
    });
  }
);

Then('{actor} is not told the host is offline', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  // The notice is confirmed after a short absence. Wait that window out.
  await w.s.advanceTime(20_000);
  expect(await w.s.read(spaceHostOfflineShown, actor)).toBe(false);
});

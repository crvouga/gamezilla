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
import { Given, Then } from '@libs/harness/define';
import { signedInAccountOf } from '@libs/harness/identity';
import type { Actor } from '@libs/harness/parameter-types';
import { cutConnection, otherDevice } from '@libs/harness/platform';
import { backToTabs } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { recall, remember } from '@libs/harness/spec-world';
import { createSpace } from '@libs/spaces-harness/space-actions';
import { ownSpaceCard } from '@libs/spaces-harness/space-ui';
import {
  activeSpaceVisible,
  readSpaceLink,
} from '@libs/spaces-harness/spaces-ui-reads';
import { OFFLINE_SPACE_LINK } from './space-offline.steps';

const PHONE_SPACE_LINK = 'phoneCreatedSpaceLink';
const SECOND_MS = 1_000;

async function offlineSpace(w: HarnessWorld, actor: string): Promise<string> {
  await cutConnection(w, actor as Actor);
  await w.s.apply(createSpace, actor);
  const link = await w.s.read(readSpaceLink, actor);
  if (link === null) throw new Error(`${actor} created no offline space`);
  return link;
}

async function twoOfflineSpaces(w: HarnessWorld, actor: Actor): Promise<void> {
  const device = otherDevice(actor);
  const present = await w.s.read((s) => s.actors.has(device));
  if (!present || (await w.s.read(signedInAccountOf, device)) === null) {
    await w.s.apply(signInWithGoogleAsAccount, device, actor);
    await w.s.apply(returnToTabs, device);
  }
  remember(w, PHONE_SPACE_LINK, await offlineSpace(w, actor));
  await offlineSpace(w, device);
}

Given(
  '{actor} is hosting a space created offline on her phone and a later space created offline on her other device',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(returnToTabs, actor);
    await twoOfflineSpaces(w, actor);
  }
);

Given(
  '{actor} is a Plus member hosting a space created offline on her phone and a later space created offline on her other device',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(openBilling, actor);
    await w.s.apply(subscribeToPlus, actor);
    await w.s.apply(backToTabs, actor);
    await twoOfflineSpaces(w, actor);
  }
);

Then(
  '{actor} is not offered to return to their space on her other device',
  async (w, actor: Actor) => {
    const device = otherDevice(actor);
    expect(await w.s.read(activeSpaceVisible, device)).toBe(false);
    expect(await w.s.read(ownSpaceCard, device)).toBeNull();
  }
);

Then("{actor}'s other device is in the same space", async (w, actor: Actor) => {
  expect(await w.s.read(readSpaceLink, otherDevice(actor))).toBe(
    recall(w, OFFLINE_SPACE_LINK) as string
  );
});

Then(
  "{actor}'s other device is in the space her phone created",
  async (w, actor: Actor) => {
    const wanted = recall(w, PHONE_SPACE_LINK);
    await w.s.until((s) => readSpaceLink(s, otherDevice(actor)), {
      pred: (link) => link === wanted,
      maxMs: 20 * SECOND_MS,
    });
  }
);

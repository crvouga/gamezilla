/** The devices signed into an account. */

import { expect } from 'bun:test';
import { openAccount, signOut } from '@libs/harness';
import { type Actor, Given, Then, When } from '@libs/harness/spec/define';
import { otherDevice } from '@libs/harness/spec/steps/platform';
import type { HarnessWorld } from '@libs/harness/spec/world';
import {
  currentDeviceMarked,
  devicesShown,
  openDevices,
} from '@libs/profile/harness/account-devices';

const SECOND_MS = 1_000;
const LIST_WAIT_MS = 15_000;

async function devicesWithin(
  w: HarnessWorld,
  actor: Actor,
  count: number,
  maxMs: number
): Promise<void> {
  await w.s.until((harness) => devicesShown(harness, actor), {
    pred: (shown) => shown === count,
    maxMs,
  });
}

Given(
  '{actor} has signed out on their other device',
  async (w, actor: Actor) => {
    await w.s.apply(openAccount, otherDevice(actor));
    await w.s.apply(signOut, otherDevice(actor));
  }
);

When('{actor} opens their devices', async (w, actor: Actor) => {
  await w.s.apply(openDevices, actor);
});

Then(
  '{actor} sees {int} device(s) on their account',
  async (w, actor: Actor, count: number) => {
    await devicesWithin(w, actor, count, LIST_WAIT_MS);
  }
);

Then(
  '{actor} sees {int} device(s) on their account within {int} seconds',
  async (w, actor: Actor, count: number, seconds: number) => {
    await devicesWithin(w, actor, count, seconds * SECOND_MS);
  }
);

Then(
  "{actor}'s devices mark the one {actor} is using",
  async (w, actor: Actor, holder: Actor) => {
    expect(holder).toBe(actor);
    expect(await w.s.read(currentDeviceMarked, actor)).toBe(true);
  }
);

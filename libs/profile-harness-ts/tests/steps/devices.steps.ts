/** The devices signed into an account. */

import { expect } from 'bun:test';
import { signOut } from '@libs/harness-ts/auth-actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { otherDevice } from '@libs/harness-ts/platform';
import { openAccount } from '@libs/harness-ts/shell-actions';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  currentDeviceMarked,
  devicesShown,
  openDevices,
} from '@libs/profile-harness-ts/account-devices';

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

/**
 * Signing in and out, which account a device is in, and the sign-in methods
 * the account screen lists — shared by the profile and account features.
 */

import { expect } from 'bun:test';

import {
  focusActor,
  openAccount,
  signedInAccountOf,
  signedOutShown,
  signInMethodsShown,
  signInWithApple,
  signOut,
} from '@libs/sim-harness';
import { type Actor, Then, When } from '@libs/sim-harness/spec/define';
import { otherDevice } from '@libs/sim-harness/spec/steps/platform';
import {
  recall,
  type SimWorld,
  signedInAccountKey,
} from '@libs/sim-harness/spec/world';

const SECOND_MS = 1_000;
const METHODS_WAIT_MS = 20_000;

async function signedOutWithin(
  w: SimWorld,
  device: string,
  seconds: number
): Promise<void> {
  await w.s.apply(focusActor, device);
  await w.s.until((sim) => signedOutShown(sim, device), {
    pred: (signedOut) => signedOut,
    maxMs: seconds * SECOND_MS,
  });
}

When('{actor} signs in with Apple', async (w, actor: Actor) => {
  await w.s.apply(signInWithApple, actor, { account: 'icloud' });
});

When(
  '{actor} signs in with Apple using the same address',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithApple, actor, { account: 'gmail' });
  }
);

When(
  '{actor} signs in with Apple and hides their address',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithApple, actor, {
      account: 'gmail',
      hideEmail: true,
    });
  }
);

When('{actor} signs out', async (w, actor: Actor) => {
  await w.s.apply(openAccount, actor);
  await w.s.apply(signOut, actor);
});

Then('{actor} is signed out', async (w, actor: Actor) => {
  expect(await w.s.read(signedOutShown, actor)).toBe(true);
});

Then(
  '{actor} is signed out within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await signedOutWithin(w, actor, seconds);
  }
);

Then(
  "{actor}'s other device is signed out within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await signedOutWithin(w, otherDevice(actor), seconds);
  }
);

Then(
  '{actor} is (still )signed into the same account',
  async (w, actor: Actor) => {
    expect(await w.s.read(signedInAccountOf, actor)).toBe(
      recall(w, signedInAccountKey(actor)) as string
    );
  }
);

Then('{actor} is signed into a different account', async (w, actor: Actor) => {
  const account = await w.s.read(signedInAccountOf, actor);
  expect(account).not.toBeNull();
  expect(account).not.toBe(recall(w, signedInAccountKey(actor)) as string);
});

Then(
  "{actor}'s sign-in methods are (still ){methods}",
  async (w, actor: Actor, methods: readonly string[]) => {
    await w.s.until((sim) => signInMethodsShown(sim, actor), {
      pred: (shown) => shown?.join(',') === methods.join(','),
      maxMs: METHODS_WAIT_MS,
    });
  }
);

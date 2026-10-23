/**
 * Signing in and out, which account a device is in, and the sign-in methods
 * the account screen lists — shared by the profile and account features.
 */

import { expect } from 'bun:test';
import { signInWithApple, signOut } from '@libs/harness-ts/auth-actions';
import { Then, When } from '@libs/harness-ts/define';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { otherDevice } from '@libs/harness-ts/platform';
import { focusActor, openAccount } from '@libs/harness-ts/shell-actions';
import {
  signedOutShown,
  signInMethodsShown,
} from '@libs/harness-ts/sign-in-method-actions';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { recall, signedInAccountKey } from '@libs/harness-ts/spec-world';

const SECOND_MS = 1_000;
const METHODS_WAIT_MS = 20_000;

async function signedOutWithin(
  w: HarnessWorld,
  device: string,
  seconds: number
): Promise<void> {
  await w.s.apply(focusActor, device);
  await w.s.until((harness) => signedOutShown(harness, device), {
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

async function signInMethodsWithin(
  w: HarnessWorld,
  actor: Actor,
  methods: readonly string[],
  maxMs: number
): Promise<void> {
  await w.s.until((harness) => signInMethodsShown(harness, actor), {
    pred: (shown) => shown?.join(',') === methods.join(','),
    maxMs,
  });
}

Then(
  "{actor}'s sign-in methods are (still ){methods}",
  async (w, actor: Actor, methods: readonly string[]) => {
    await signInMethodsWithin(w, actor, methods, METHODS_WAIT_MS);
  }
);

Then(
  "{actor}'s sign-in methods are {methods} within {int} seconds",
  async (w, actor: Actor, methods: readonly string[], seconds: number) => {
    await signInMethodsWithin(w, actor, methods, seconds * SECOND_MS);
  }
);

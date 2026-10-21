/** Ending sessions: signing out everywhere, and Apple acting on its side. */

import { expect } from 'bun:test';
import { signInWithApple, signInWithGoogle } from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import { signedInAccountOf } from '@libs/harness/identity';
import type { Actor } from '@libs/harness/parameter-types';
import { otherDevice } from '@libs/harness/platform';
import {
  appleDeletesAccount,
  appleRevokesApp,
} from '@libs/harness/provider-events-actions';
import { focusActor } from '@libs/harness/shell-actions';
import {
  signedOutNoticeShown,
  signInAgainOffered,
} from '@libs/harness/shell-notices';
import {
  connectSignInMethod,
  signedOutShown,
  signOutEverywhere,
} from '@libs/harness/sign-in-method-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { remember, signedInAccountKey } from '@libs/harness/spec-world';

/** The Apple Account these scenarios sign in with: not linked to Google. */
const APPLE_ACCOUNT = 'icloud';
const SIGNED_OUT_WAIT_MS = 150_000;
const SECOND_MS = 1_000;

async function rememberAccount(w: HarnessWorld, actor: Actor): Promise<void> {
  const account = await w.s.read(signedInAccountOf, actor);
  if (account === null) throw new Error(`${actor} did not sign in`);
  remember(w, signedInAccountKey(actor), account);
}

Given('{actor} is signed in with Apple', async (w, actor: Actor) => {
  await w.s.apply(signInWithApple, actor, { account: APPLE_ACCOUNT });
  await rememberAccount(w, actor);
});

Given(
  '{actor} has stopped using Sign in with Apple for the app',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithApple, actor, { account: APPLE_ACCOUNT });
    await rememberAccount(w, actor);
    await w.s.apply(appleRevokesApp, actor, APPLE_ACCOUNT);
    await w.s.until((harness) => signedOutShown(harness, actor), {
      pred: (signedOut) => signedOut,
      maxMs: SIGNED_OUT_WAIT_MS,
    });
  }
);

Given(
  '{actor} has connected Apple to their account',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithGoogle, actor);
    await rememberAccount(w, actor);
    await w.s.apply(connectSignInMethod, actor, 'apple', {
      account: APPLE_ACCOUNT,
    });
  }
);

When('{actor} signs out everywhere', async (w, actor: Actor) => {
  await w.s.apply(signOutEverywhere, actor);
});

When(
  '{actor} signs out everywhere on their other device',
  async (w, actor: Actor) => {
    await w.s.apply(signOutEverywhere, otherDevice(actor));
  }
);

Given(
  '{actor} has signed out everywhere on their other device',
  async (w, actor: Actor) => {
    await w.s.apply(signOutEverywhere, otherDevice(actor));
  }
);

Then(
  '{actor} is told they were signed out within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((s) => signedOutNoticeShown(s, actor), {
      pred: (notice) => notice !== null,
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then('{actor} is offered to sign in again', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  expect(await w.s.read(signInAgainOffered, actor)).toBe(true);
});

Then('{actor} is not told they were signed out', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  expect(await w.s.read(signedOutNoticeShown, actor)).toBeNull();
});

Then(
  '{actor} is told changes they had not shared were not kept within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((s) => signedOutNoticeShown(s, actor), {
      pred: (notice) => notice?.unsharedNotKept === true,
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  '{actor} is not told changes they had not shared were not kept',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    const notice = await w.s.read(signedOutNoticeShown, actor);
    expect(notice?.unsharedNotKept ?? false).toBe(false);
  }
);

When(
  '{actor} stops using Sign in with Apple for the app',
  async (w, actor: Actor) => {
    await w.s.apply(appleRevokesApp, actor, APPLE_ACCOUNT);
  }
);

When('{actor} deletes their Apple account', async (w, actor: Actor) => {
  await w.s.apply(appleDeletesAccount, actor, APPLE_ACCOUNT);
});

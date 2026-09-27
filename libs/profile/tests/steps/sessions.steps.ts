/** Ending sessions: signing out everywhere, and Apple acting on its side. */

import {
  appleDeletesAccount,
  appleRevokesApp,
  connectSignInMethod,
  signedInAccountOf,
  signedOutShown,
  signInWithApple,
  signInWithGoogle,
  signOutEverywhere,
} from '@libs/sim-harness';
import { type Actor, Given, When } from '@libs/sim-harness/spec/define';
import {
  remember,
  type SimWorld,
  signedInAccountKey,
} from '@libs/sim-harness/spec/world';

/** The Apple Account these scenarios sign in with: not linked to Google. */
const APPLE_ACCOUNT = 'icloud';
const SIGNED_OUT_WAIT_MS = 150_000;

async function rememberAccount(w: SimWorld, actor: Actor): Promise<void> {
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
    await w.s.until((sim) => signedOutShown(sim, actor), {
      pred: (signedOut) => signedOut,
      maxMs: SIGNED_OUT_WAIT_MS,
    });
  }
);

Given(
  '{actor} has connected Apple to their Google account',
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
  '{actor} stops using Sign in with Apple for the app',
  async (w, actor: Actor) => {
    await w.s.apply(appleRevokesApp, actor, APPLE_ACCOUNT);
  }
);

Given('{actor} has deleted their Apple account', async (w, actor: Actor) => {
  await w.s.apply(appleDeletesAccount, actor, APPLE_ACCOUNT);
});

When('{actor} deletes their Apple account', async (w, actor: Actor) => {
  await w.s.apply(appleDeletesAccount, actor, APPLE_ACCOUNT);
});

/** Session termination steps, including provider initiated events. */

import { expect } from 'bun:test';

import {
  appleDeletesAccount,
  appleRevokesApp,
  connectSignInMethod,
  focusActor,
  localSignInMethodsOf,
  serverSignInMethodsOf,
  signedInAccountOf,
  signInWithApple,
  signInWithGoogleAsAccount,
  signOutEverywhere,
} from '@libs/sim-harness';
import { type Actor, Given, Then, When } from '@libs/sim-harness/spec/define';
import {
  recall,
  remember,
  signedInAccountKey,
} from '@libs/sim-harness/spec/world';
import { Handles } from '@libs/test-ids';

Given(
  "{actor} signs into {actor}'s account on another device",
  async (w, device: Actor, owner: Actor) => {
    await w.s.apply(signInWithGoogleAsAccount, device, owner);
  }
);

Given(
  '{actor} is signed in with Apple and remembers the account',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithApple, actor);
    const account = await w.s.read(signedInAccountOf, actor);
    if (account === null)
      throw new Error(`${actor} did not sign in with Apple`);
    remember(w, signedInAccountKey(actor), account);
  }
);

Given(
  '{actor} is signed in with the private Apple account',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithApple, actor, { account: 'icloud' });
    const account = await w.s.read(signedInAccountOf, actor);
    if (account === null)
      throw new Error(`${actor} did not sign in with Apple`);
    remember(w, signedInAccountKey(actor), account);
  }
);

When('{actor} signs out everywhere', async (w, actor: Actor) => {
  await w.s.apply(signOutEverywhere, actor);
});

Then('{actor} is signed out', async (w, actor: Actor) => {
  expect(await w.s.read(signedInAccountOf, actor)).toBeNull();
});

Then(
  '{actor} is signed out after the session update',
  async (w, actor: Actor) => {
    await w.s.apply(focusActor, actor);
    await w.s.until(
      async (sim) =>
        sim.actors.get(actor)?.ui.get(Handles.accountSignIn).isVisible() ??
        false,
      { pred: (visible) => visible, maxMs: 150_000 }
    );
  }
);

Then(
  "{actor}'s account has only Google as a sign-in method",
  async (w, actor: Actor) => {
    const account = await w.s.read(signedInAccountOf, actor);
    if (account === null) throw new Error(`${actor} is signed out`);
    await w.s.until((sim) => serverSignInMethodsOf(sim, account), {
      pred: (methods) => methods.join(',') === 'google',
      maxMs: 20_000,
    });
  }
);

When('Apple revokes the app for {actor}', async (w, actor: Actor) => {
  await w.s.apply(appleRevokesApp, actor);
});

When('{actor} signs in with Apple again', async (w, actor: Actor) => {
  await w.s.apply(signInWithApple, actor);
});

When('{actor} deletes that Apple account', async (w, actor: Actor) => {
  await w.s.apply(appleDeletesAccount, actor, 'icloud');
});

Then('{actor} has no remaining sign-in methods', async (w, actor: Actor) => {
  expect(await w.s.read(localSignInMethodsOf, actor)).toEqual([]);
});

When('{actor} connects Apple', async (w, actor: Actor) => {
  await w.s.apply(connectSignInMethod, actor, 'apple');
});

When("Apple deletes {actor}'s private account", async (w, actor: Actor) => {
  await w.s.apply(appleDeletesAccount, actor, 'icloud');
});

Then(
  '{actor} remains signed into the remembered account',
  async (w, actor: Actor) => {
    expect(await w.s.read(signedInAccountOf, actor)).toBe(
      recall(w, signedInAccountKey(actor)) as string | null
    );
  }
);

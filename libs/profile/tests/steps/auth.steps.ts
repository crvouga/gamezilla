/** Provider sign-in steps for the profile and account features. */

import { expect } from 'bun:test';

import {
  localSignInMethodsOf,
  returnToTabs,
  signedInAccountOf,
  signInWithApple,
  signInWithGoogle,
} from '@libs/sim-harness';
import { type Actor, Then, When } from '@libs/sim-harness/spec/define';
import {
  recall,
  remember,
  signedInAccountKey,
} from '@libs/sim-harness/spec/world';

When('{actor} signs in with Apple', async (w, actor: Actor) => {
  await w.s.apply(signInWithApple, actor);
});

When(
  '{actor} signs in with Google and remembers the account',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithGoogle, actor);
    const account = await w.s.read(signedInAccountOf, actor);
    if (account === null) throw new Error(`${actor} did not sign in`);
    remember(w, signedInAccountKey(actor), account);
  }
);

When(
  '{actor} signs in with Apple using the shared address',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithApple, actor, { account: 'gmail' });
  }
);

When(
  '{actor} signs in with Apple using a private address',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithApple, actor, {
      account: 'icloud',
      hideEmail: true,
    });
  }
);

Then('{actor} can sign in with Apple', async (w, actor: Actor) => {
  await w.s.until((sim) => localSignInMethodsOf(sim, actor), {
    pred: (methods) => methods.join(',') === 'apple',
    maxMs: 20_000,
  });
});

Then(
  '{actor} is still signed into the remembered account',
  async (w, actor: Actor) => {
    expect(await w.s.read(signedInAccountOf, actor)).toBe(
      recall(w, signedInAccountKey(actor)) as string | null
    );
  }
);

Then(
  '{actor} has Google and Apple sign-in methods',
  async (w, actor: Actor) => {
    await w.s.until((sim) => localSignInMethodsOf(sim, actor), {
      pred: (methods) => methods.join(',') === 'apple,google',
      maxMs: 20_000,
    });
  }
);

Then('{actor} is signed into a different account', async (w, actor: Actor) => {
  expect(await w.s.read(signedInAccountOf, actor)).not.toBe(
    recall(w, signedInAccountKey(actor)) as string | null
  );
});

Then('{actor} can return to the tabs', async (w, actor: Actor) => {
  await w.s.apply(returnToTabs, actor);
});

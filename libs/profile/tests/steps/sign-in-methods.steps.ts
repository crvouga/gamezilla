/** Account linking and removal steps. */

import { expect } from 'bun:test';

import {
  confirmAccountLink,
  connectSignInMethod,
  keepSeparateAccount,
  localSignInMethodsOf,
  removeSignInMethod,
  seedProviderAccount,
  signedInAccountOf,
  signInWithApple,
  signInWithProviderAs,
} from '@libs/sim-harness';
import { type Actor, Given, Then, When } from '@libs/sim-harness/spec/define';
import {
  recall,
  remember,
  signedInAccountKey,
} from '@libs/sim-harness/spec/world';
import { Handles } from '@libs/test-ids';

const earlierAppleKey = (actor: Actor) => `earlier-apple-account:${actor}`;
const UNVERIFIED = 'uma@unverified.test';

Given(
  '{actor} has signed in with their private Apple address',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithApple, actor, { account: 'icloud' });
    const account = await w.s.read(signedInAccountOf, actor);
    if (account === null)
      throw new Error(`${actor} did not sign in with Apple`);
    remember(w, earlierAppleKey(actor), account);
  }
);

When(
  '{actor} connects Apple with a private address',
  async (w, actor: Actor) => {
    await w.s.apply(connectSignInMethod, actor, 'apple', { hideEmail: true });
  }
);

When(
  '{actor} signs in with their private Apple address',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithApple, actor, { account: 'icloud' });
  }
);

When('{actor} removes Apple from their account', async (w, actor: Actor) => {
  await w.s.apply(removeSignInMethod, actor, 'apple');
});

Then('{actor} has only Google as a sign-in method', async (w, actor: Actor) => {
  await w.s.until((sim) => localSignInMethodsOf(sim, actor), {
    pred: (methods) => methods.join(',') === 'google',
    maxMs: 20_000,
  });
});

When('{actor} tries to remove Google', async (w, actor: Actor) => {
  const confirmed = await w.s.read(async (sim) => {
    const ui = sim.actors.get(actor)?.ui;
    if (ui === undefined) return false;
    await ui.get(Handles.accountUnlinkProvider('google')).tap();
    return await ui.get(Handles.accountUnlinkConfirm).isVisible();
  });
  remember(w, `remove-confirmed:${actor}`, confirmed);
});

Then(
  "{actor}'s only sign-in method remains connected",
  async (w, actor: Actor) => {
    expect(recall(w, `remove-confirmed:${actor}`)).toBe(false);
    expect(await w.s.read(localSignInMethodsOf, actor)).toEqual(['google']);
  }
);

When(
  '{actor} tries to connect the Apple account they used earlier',
  async (w, actor: Actor) => {
    await w.s.apply(connectSignInMethod, actor, 'apple', { account: 'icloud' });
  }
);

Then(
  '{actor} is told that Apple account belongs to another account',
  async (w, actor: Actor) => {
    const message = await w.s.until(
      async (sim) =>
        (await sim.actors
          .get(actor)
          ?.ui.get(Handles.accountSignInMethod('apple'))
          .text()) ?? '',
      {
        pred: (text) =>
          text.includes('already signs in to a different account'),
        maxMs: 20_000,
      }
    );
    expect(message).toContain('already signs in to a different account');
  }
);

Given(
  '{actor} has matching unverified Google and Apple addresses',
  async (w) => {
    await w.s.apply(seedProviderAccount, 'google', {
      handle: 'uma',
      email: UNVERIFIED,
      emailVerified: false,
    });
    await w.s.apply(seedProviderAccount, 'apple', {
      handle: 'uma',
      email: UNVERIFIED,
    });
  }
);

When(
  '{actor} signs in with Google at the unverified address',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithProviderAs, actor, {
      provider: 'google',
      email: UNVERIFIED,
    });
    const account = await w.s.read(signedInAccountOf, actor);
    if (account === null) throw new Error(`${actor} did not sign in`);
    remember(w, signedInAccountKey(actor), account);
  }
);

When(
  '{actor} signs in with Apple at the unverified address',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithProviderAs, actor, {
      provider: 'apple',
      email: UNVERIFIED,
    });
  }
);

Then('{actor} is asked to prove the account match', async (w, actor: Actor) => {
  await w.s.until(
    async (sim) =>
      sim.actors.get(actor)?.ui.get(Handles.authLinkRequired).isVisible() ??
      false,
    { pred: (shown) => shown, maxMs: 20_000 }
  );
  expect(await w.s.read(signedInAccountOf, actor)).toBeNull();
});

When('{actor} confirms the match with Google', async (w, actor: Actor) => {
  await w.s.apply(confirmAccountLink, actor, 'google', UNVERIFIED);
});

Then(
  '{actor} is signed into the remembered account',
  async (w, actor: Actor) => {
    expect(await w.s.read(signedInAccountOf, actor)).toBe(
      recall(w, signedInAccountKey(actor)) as string | null
    );
  }
);

When('{actor} remembers the signed-in account', async (w, actor: Actor) => {
  const account = await w.s.read(signedInAccountOf, actor);
  if (account === null) throw new Error(`${actor} is not signed in`);
  remember(w, signedInAccountKey(actor), account);
});

When('{actor} keeps the accounts separate', async (w, actor: Actor) => {
  await w.s.apply(keepSeparateAccount, actor);
});

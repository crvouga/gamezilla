/** Connecting, removing, and proving sign-in methods. */

import {
  accountMatchPromptShown,
  confirmAccountLink,
  connectSignInMethod,
  keepSeparateAccount,
  openAccount,
  removeSignInMethod,
  seedProviderAccount,
  signedInAccountOf,
  signInMethodRowText,
  signInWithApple,
  signInWithProviderAs,
  signOut,
  tryRemoveSignInMethod,
} from '@libs/sim-harness';
import { type Actor, Given, Then, When } from '@libs/sim-harness/spec/define';
import {
  remember,
  type SimWorld,
  signedInAccountKey,
} from '@libs/sim-harness/spec/world';

/** An address Google holds for Alice but never verified; Apple shares it. */
const UNVERIFIED = 'uma@unverified.test';
const UNVERIFIED_HANDLE = 'uma';
const PROMPT_WAIT_MS = 20_000;
const ALREADY_LINKED = 'already signs in to a different account';

async function signInWithGoogleUnverified(
  w: SimWorld,
  actor: Actor
): Promise<void> {
  await w.s.apply(seedProviderAccount, 'google', {
    handle: UNVERIFIED_HANDLE,
    email: UNVERIFIED,
    emailVerified: false,
  });
  await w.s.apply(seedProviderAccount, 'apple', {
    handle: UNVERIFIED_HANDLE,
    email: UNVERIFIED,
  });
  await w.s.apply(signInWithProviderAs, actor, {
    provider: 'google',
    email: UNVERIFIED,
  });
  const account = await w.s.read(signedInAccountOf, actor);
  if (account === null) throw new Error(`${actor} did not sign in`);
  remember(w, signedInAccountKey(actor), account);
}

async function signInWithAppleUnverified(
  w: SimWorld,
  actor: Actor
): Promise<void> {
  await w.s.apply(signInWithProviderAs, actor, {
    provider: 'apple',
    email: UNVERIFIED,
  });
}

Given(
  "{actor}'s Apple account already signs into a separate account",
  async (w, actor: Actor) => {
    await w.s.apply(signInWithApple, actor, { account: 'icloud' });
    await w.s.apply(openAccount, actor);
    await w.s.apply(signOut, actor);
  }
);

Given(
  '{actor} has an account they sign into with Google at an unverified address',
  async (w, actor: Actor) => {
    await signInWithGoogleUnverified(w, actor);
  }
);

Given(
  '{actor} is being asked to prove an unverified address match',
  async (w, actor: Actor) => {
    await signInWithGoogleUnverified(w, actor);
    await w.s.apply(openAccount, actor);
    await w.s.apply(signOut, actor);
    await signInWithAppleUnverified(w, actor);
    await w.s.until((sim) => accountMatchPromptShown(sim, actor), {
      pred: (shown) => shown,
      maxMs: PROMPT_WAIT_MS,
    });
  }
);

When('{actor} connects Apple', async (w, actor: Actor) => {
  await w.s.apply(connectSignInMethod, actor, 'apple');
});

When('{actor} removes Apple from their account', async (w, actor: Actor) => {
  await w.s.apply(removeSignInMethod, actor, 'apple');
});

When('{actor} tries to remove Google', async (w, actor: Actor) => {
  await w.s.apply(tryRemoveSignInMethod, actor, 'google');
});

When('{actor} tries to connect that Apple account', async (w, actor: Actor) => {
  await w.s.apply(connectSignInMethod, actor, 'apple', { account: 'icloud' });
});

When(
  '{actor} signs in with Apple at the same address',
  async (w, actor: Actor) => {
    await signInWithAppleUnverified(w, actor);
  }
);

When('{actor} confirms the match with Google', async (w, actor: Actor) => {
  await w.s.apply(confirmAccountLink, actor, 'google', UNVERIFIED);
});

When('{actor} keeps the accounts separate', async (w, actor: Actor) => {
  await w.s.apply(keepSeparateAccount, actor);
});

Then(
  '{actor} is told that Apple account belongs to another account',
  async (w, actor: Actor) => {
    await w.s.until((sim) => signInMethodRowText(sim, actor, 'apple'), {
      pred: (text) => text.includes(ALREADY_LINKED),
      maxMs: PROMPT_WAIT_MS,
    });
  }
);

Then('{actor} is asked to prove the account match', async (w, actor: Actor) => {
  await w.s.until((sim) => accountMatchPromptShown(sim, actor), {
    pred: (shown) => shown,
    maxMs: PROMPT_WAIT_MS,
  });
});

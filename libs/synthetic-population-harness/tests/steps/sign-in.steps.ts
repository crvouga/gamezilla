import { expect } from 'bun:test';
import { signOut } from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import {
  emailSignInOffered,
  requestEmailLinkOutsideApp,
  requestsLeavingTheSimulation,
  startSigningIn,
} from '@libs/harness/email-link-actions';
import { signedInAccountOf } from '@libs/harness/identity';
import type { Actor } from '@libs/harness/parameter-types';
import { openAccount } from '@libs/harness/shell-actions';
import { recall, remember } from '@libs/harness/spec-world';
import {
  requestSyntheticUserSignInLink,
  signInLinksWaitingFor,
  signInMailAddresses,
  signInSyntheticUser,
  syntheticUserActor,
  syntheticUserHasAddress,
  syntheticUserSignIn,
} from '@libs/synthetic-population-harness/synthetic-sign-in-actions';
import {
  givenLeasedSyntheticUser,
  givenSyntheticUser,
} from '@libs/synthetic-population-harness/synthetic-user-fixtures';
import { rememberContinuity } from './continuity-memo';

/** Memo key of the email address a sign-in link was last asked for at. */
const ASKED_AT = 'synthetic-population:sign-in-link-asked-at';

// --- A Synthetic User ----------------------------------------------------------

Given(
  'the Synthetic User {string} has never signed in',
  async (w, name: string) => {
    await w.s.apply(givenLeasedSyntheticUser, name);
    expect(
      await w.s.read(signedInAccountOf, syntheticUserActor(name))
    ).toBeNull();
  }
);

Given('the Synthetic User {string} has signed out', async (w, name: string) => {
  await w.s.apply(givenSyntheticUser, name, false);
  await rememberContinuity(w);
  await w.s.apply(openAccount, syntheticUserActor(name));
  await w.s.apply(signOut, syntheticUserActor(name));
});

When(
  'the Synthetic User {string} signs in with a sign-in link sent to its own email address',
  async (w, name: string) => {
    // regression: password-form-macro-runtime
    await w.s.apply(
      signInSyntheticUser,
      syntheticUserActor(name),
      await w.s.read(syntheticUserSignIn, name)
    );
  }
);

When(
  'the Synthetic User {string} asks for a sign-in link at its own email address',
  async (w, name: string) => {
    const { email } = await w.s.read(syntheticUserSignIn, name);
    await w.s.apply(
      requestSyntheticUserSignInLink,
      syntheticUserActor(name),
      remember(w, ASKED_AT, email)
    );
  }
);

Then('the Synthetic User {string} is signed in', async (w, name: string) => {
  expect(
    await w.s.read(signedInAccountOf, syntheticUserActor(name))
  ).not.toBeNull();
});

Then(
  "the sign-in link arrives in the Synthetic Population's mailbox",
  async (w) => {
    expect(
      await w.s.read(signInLinksWaitingFor, recall(w, ASKED_AT) as string)
    ).toBe(1);
  }
);

Then('no real mail is sent', async (w) => {
  expect(await w.s.read(requestsLeavingTheSimulation)).toEqual([]);
});

// --- A person ------------------------------------------------------------------

Given(
  'no Synthetic User has the email address {string}',
  async (w, email: string) => {
    expect(await w.s.read(syntheticUserHasAddress, email)).toBe(false);
  }
);

When(
  '{actor} tries to ask for a sign-in link at {string}',
  async (w, actor: Actor, email: string) => {
    await w.s.apply(requestEmailLinkOutsideApp, actor, email);
  }
);

// Nothing was kept for the address, and nothing left for a mailbox outside.
Then(
  'no sign-in link arrives in the mailbox of {string}',
  async (w, email: string) => {
    expect(await w.s.read(signInMailAddresses)).not.toContain(email);
    expect(await w.s.read(requestsLeavingTheSimulation)).toEqual([]);
  }
);

When('{actor} starts signing in', async (w, actor: Actor) => {
  await w.s.apply(startSigningIn, actor);
});

Then('{actor} is not offered a sign-in link', async (w, actor: Actor) => {
  expect(await w.s.read(emailSignInOffered, actor)).toBe(false);
});

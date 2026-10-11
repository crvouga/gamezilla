/**
 * Steps for `specs/auth/sign-in-link.feature`: asking for a sign-in link at
 * an email address, opening it from the mailbox it arrived in, time passing
 * before it is opened, and an environment with or without a way to send
 * mail — each a harness action on the example app, each outcome a read of
 * what the device was told, what was mailed, or what it is signed into.
 */

import { expect } from 'bun:test';
import {
  emailLinksMailed,
  latestEmailLink,
  openEmailLinkNumber,
  requestEmailLink,
  setMailAvailable,
  signInMethodsOffered,
  signInMethodsOfferedTo,
  startSigningIn,
} from '@pkgs/auth-root-harness/email-link-actions';
import { lastOutcome, signedInUser } from '@pkgs/auth-root-harness/system';
import { AUTH_ERROR } from '@pkgs/auth-root-shared/auth-error-code';
import type { SignInWorld } from './world';
import { device, Given, linkOf, ownEmailAddress, Then, When } from './world';

const MINUTE_MS = 60_000;

/** The person asks for a sign-in link at an address: the next link asked for. */
async function askAt(
  w: SignInWorld,
  actor: string,
  email: string
): Promise<void> {
  await w.s.apply(requestEmailLink, { clientId: device(w, actor), email });
  w.asked.push(email);
  w.links.set(actor, w.asked.length);
}

/** The person opens the sign-in link they last asked for. */
async function openAsked(w: SignInWorld, actor: string): Promise<void> {
  await w.s.apply(openEmailLinkNumber, {
    clientId: device(w, actor),
    number: linkOf(w, actor),
  });
}

// --- Asking -------------------------------------------------------------------

Given('{actor} has asked for a sign-in link at {string}', askAt);

Given(
  '{actor} asked for a sign-in link at {string} {int} minutes ago',
  async (w, actor: string, email: string, minutes: number) => {
    await askAt(w, actor, email);
    await w.s.advanceTime(minutes * MINUTE_MS);
  }
);

Given(
  '{actor} has signed in with a sign-in link sent to {string}',
  async (w, actor: string, email: string) => {
    await askAt(w, actor, email);
    await openAsked(w, actor);
    const account = await w.s.read(signedInUser, device(w, actor));
    if (account === null) {
      throw new Error(`${actor} could not sign in with a sign-in link`);
    }
    w.accounts.set(actor, account);
  }
);

When('{actor} asks for a sign-in link at {string}', askAt);

Then(
  '{actor} is told a sign-in link is on its way to {string}',
  async (w, actor: string, _email: string) => {
    expect(await w.s.read(lastOutcome, device(w, actor))).toEqual({
      kind: 'ok',
    });
  }
);

// Every sign-in link asked for was mailed, and the newest is in this mailbox.
Then(
  'the sign-in link arrives in the mailbox of {string}',
  async (w, email: string) => {
    const mailed = await w.s.read(emailLinksMailed);
    expect(mailed).toHaveLength(w.asked.length);
    expect(mailed.at(-1)?.email).toBe(email);
  }
);

// --- Opening ------------------------------------------------------------------

When('{actor} opens the( same) sign-in link( again)', openAsked);

// No sign-in link is in the one mailbox the person reads: their own.
Then('{actor} cannot open the sign-in link', async (w, actor: string) => {
  expect(await w.s.read(latestEmailLink, ownEmailAddress(actor))).toBeNull();
});

Then(
  '{actor} is told the sign-in link no longer works',
  async (w, actor: string) => {
    expect(await w.s.read(lastOutcome, device(w, actor))).toEqual({
      kind: 'error',
      code: AUTH_ERROR.expired,
    });
  }
);

// --- A way to send mail ---------------------------------------------------------

Given('this environment has a way to send mail', async (w) => {
  await w.s.apply(setMailAvailable, true);
  expect(await w.s.read(signInMethodsOffered)).toContain('email');
});

Given('this environment has no way to send mail', async (w) => {
  await w.s.apply(setMailAvailable, false);
});

When('{actor} starts signing in', async (w, actor: string) => {
  await w.s.apply(startSigningIn, device(w, actor));
});

Then('{actor} is not offered a sign-in link', async (w, actor: string) => {
  const offered = await w.s.read(signInMethodsOfferedTo, device(w, actor));
  expect(offered).not.toBeNull();
  expect(offered).not.toContain('email');
});

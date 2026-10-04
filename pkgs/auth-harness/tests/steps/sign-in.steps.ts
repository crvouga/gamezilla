/**
 * Steps for `specs/auth/`: people signing in, confirming matching accounts,
 * managing sign-in methods, stolen sign-ins, time passing, and what happens
 * at Google and Apple — each a harness action on the example app, each
 * outcome a read of what the device was told or is signed into.
 */

import { expect } from 'bun:test';
import { AUTH_ERROR } from '@pkgs/auth-shared/auth-error-code';
import type { OauthProviderId } from '@pkgs/auth-shared/sign-in-method';
import { accountsOnRecord, awaitingProof, identitiesOf, lastOutcome, signedInUser } from '@pkgs/auth-harness/system';
import { appleAccountDeleted, appleConsentRevoked, appleRelayForwarding, clearProviderFaults, confirmPendingLink, declinePendingLink, googleEmailChanged, linkProvider, prepareLink, setOnline, setProviderFault, signIn, signOut, signOutEverywhere, stealBearer, unlinkProvider } from '@pkgs/auth-harness/actions';
import { movedGoogleEmail } from '@pkgs/auth-harness/world-flows';

import { accountOf, answers, currentEmailOf, device, emailOf, Given, handOver, onDevice, SECOND_GOOGLE_ACCOUNT, Then, When } from './world';
import type { SignInWorld } from './world';

const MINUTE_MS = 60_000;
/** The device key of "a shared device" / "that device". */
const SHARED_DEVICE = 'shared device';
const DAY_MS = 24 * 60 * MINUTE_MS;

async function signInAs(
  w: SignInWorld,
  actor: string,
  provider: OauthProviderId,
  nth = 1
): Promise<string> {
  const args = onDevice(w, actor, provider, { nth });
  await w.s.apply(signIn, args);
  const account = await w.s.read(signedInUser, args.clientId);
  if (account === null) {
    throw new Error(`${actor} could not sign in with ${provider}`);
  }
  w.accounts.set(actor, account);
  return account;
}

async function expectOk(w: SignInWorld, actor: string): Promise<void> {
  expect(await w.s.read(lastOutcome, device(w, actor))).toEqual({
    kind: 'ok',
  });
}

async function expectTold(
  w: SignInWorld,
  actor: string,
  code: string
): Promise<void> {
  expect(await w.s.read(lastOutcome, device(w, actor))).toEqual({
    kind: 'error',
    code,
  });
}

/** Carol has a Google account at an unverified address, and signs in with Apple there. */
async function askToConfirm(w: SignInWorld, actor: string): Promise<void> {
  await signInAs(w, actor, 'google');
  await w.s.apply(signOut, device(w, actor));
  await w.s.apply(signIn, onDevice(w, actor, 'apple'));
  if (!(await w.s.read(awaitingProof, device(w, actor)))) {
    throw new Error(`${actor} was not asked to confirm a matching account`);
  }
}

/** The providers of the account the person was last seen signed into. */
async function methodsOf(w: SignInWorld, actor: string): Promise<string[]> {
  const accounts = await w.s.read(accountsOnRecord);
  const mine = accounts.find((row) => row.id === accountOf(w, actor));
  return (mine?.methods ?? []).map((row) => row.provider).sort();
}

async function signedIn(w: SignInWorld, actor: string, nth = 1) {
  return await w.s.read(signedInUser, device(w, actor, nth));
}

async function methodOf(w: SignInWorld, actor: string, provider: string) {
  const methods = await w.s.read(identitiesOf, device(w, actor));
  return methods.find((row) => row.provider === provider);
}

// --- Signing in --------------------------------------------------------------

Given(
  '{actor} is signed in with their {provider} account',
  async (w, actor: string, provider: OauthProviderId) => {
    await signInAs(w, actor, provider);
  }
);

Given(
  '{actor} has an account they sign into with Google',
  async (w, actor: string) => {
    await signInAs(w, actor, 'google');
    await w.s.apply(signOut, device(w, actor));
  }
);

Given(
  '{actor} is also signed in on a second device',
  async (w, actor: string) => {
    await signInAs(w, actor, 'google', 2);
  }
);

Given('{actor} has no account yet', async (w, actor: string) => {
  expect(await signedIn(w, actor)).toBeNull();
});

When(
  '{actor} signs in with their {provider} account',
  async (w, actor: string, provider: OauthProviderId) => {
    await w.s.apply(signIn, onDevice(w, actor, provider));
  }
);

When(
  '{actor} tries to sign in with {provider}',
  async (w, actor: string, provider: OauthProviderId) => {
    await w.s.apply(signIn, onDevice(w, actor, provider));
  }
);

When(
  '{actor} signs in with Apple on another device',
  async (w, actor: string) => {
    await w.s.apply(signIn, onDevice(w, actor, 'apple', { nth: 2 }));
  }
);

When(
  '{actor} declines the app while signing in with Apple',
  async (w, actor: string) => {
    await w.s.apply(
      signIn,
      onDevice(w, actor, 'apple', { extra: { consent: 'deny' } })
    );
  }
);

When(
  '{actor} signs in with Apple, hiding their email address',
  async (w, actor: string) => {
    await w.s.apply(
      signIn,
      onDevice(w, actor, 'apple', { extra: { emailChoice: 'hide' } })
    );
  }
);

Given(
  '{actor} is signed in with Apple and hid their email address',
  async (w, actor: string) => {
    await w.s.apply(
      signIn,
      onDevice(w, actor, 'apple', { extra: { emailChoice: 'hide' } })
    );
    await expectOk(w, actor);
  }
);

Then('{actor} is signed out', async (w, actor: string) => {
  expect(await signedIn(w, actor)).toBeNull();
});

Then('{actor} is still signed in', async (w, actor: string) => {
  expect(await signedIn(w, actor)).not.toBeNull();
});

Then('{actor} is signed into a new account', async (w, actor: string) => {
  const account = await signedIn(w, actor);
  expect(account).not.toBeNull();
  expect([...w.accounts.values()]).not.toContain(account);
});

Then(
  '{actor} is (still )signed into the same account',
  async (w, actor: string) => {
    expect(await signedIn(w, actor)).toBe(accountOf(w, actor));
  }
);

Then(
  '{actor} is still signed into their own account',
  async (w, actor: string) => {
    expect(await signedIn(w, actor)).toBe(accountOf(w, actor));
  }
);

Then(
  "{actor}'s other device is signed into a different account",
  async (w, actor: string) => {
    const other = await signedIn(w, actor, 2);
    expect(other).not.toBeNull();
    expect(other).not.toBe(accountOf(w, actor));
  }
);

Then("{actor}'s second device is signed out", async (w, actor: string) => {
  expect(await signedIn(w, actor, 2)).toBeNull();
});

Then('{actor} is told signing in was cancelled', async (w, actor: string) => {
  await expectTold(w, actor, AUTH_ERROR.cancelled);
});

// --- Matching accounts -------------------------------------------------------

Given(
  '{actor} is being asked to confirm the matching account with Google',
  async (w, actor: string) => {
    await askToConfirm(w, actor);
  }
);

Given(
  '{actor} was asked to confirm the matching account with Google {int} minutes ago',
  async (w, actor: string, minutes: number) => {
    await askToConfirm(w, actor);
    await w.s.advanceTime(minutes * MINUTE_MS);
  }
);

When(
  '{actor} confirms the matching account with Google',
  async (w, actor: string) => {
    await w.s.apply(confirmPendingLink, onDevice(w, actor, 'google'));
  }
);

When(
  "{actor} confirms the matching account with {actor}'s Google account",
  async (w, actor: string, owner: string) => {
    await w.s.apply(confirmPendingLink, {
      clientId: device(w, actor),
      provider: 'google',
      answers: answers(w, owner, 'google'),
    });
  }
);

When('{actor} keeps the accounts separate', async (w, actor: string) => {
  await w.s.apply(declinePendingLink, device(w, actor));
});

Then(
  '{actor} is told to confirm the matching account first',
  async (w, actor: string) => {
    expect((await w.s.read(lastOutcome, device(w, actor)))?.kind).toBe(
      'link_required'
    );
  }
);

Then(
  '{actor} is told the matching account could not be confirmed',
  async (w, actor: string) => {
    await expectTold(w, actor, AUTH_ERROR.linkMismatch);
  }
);

Then(
  '{actor} is told the chance to confirm has lapsed',
  async (w, actor: string) => {
    await expectTold(w, actor, AUTH_ERROR.expired);
  }
);

// --- Sign-in methods ---------------------------------------------------------

Given(
  '{actor} has connected Apple to their account',
  async (w, actor: string) => {
    await signInAs(w, actor, 'google');
    await w.s.apply(linkProvider, onDevice(w, actor, 'apple'));
    await expectOk(w, actor);
  }
);

Given(
  '{actor} has removed Apple from their account',
  async (w, actor: string) => {
    await w.s.apply(unlinkProvider, {
      clientId: device(w, actor),
      provider: 'apple',
    });
    await expectOk(w, actor);
  }
);

Given(
  '{actor} has opened their sign-in methods on a shared device',
  async (w, actor: string) => {
    await signInAs(w, actor, 'apple');
    handOver(w, actor, SHARED_DEVICE);
    await w.s.apply(prepareLink, device(w, actor));
  }
);

Given('{actor} has signed out on that device', async (w, actor: string) => {
  await w.s.apply(signOut, device(w, actor));
});

Given(
  '{actor} has signed in with Google on that device',
  async (w, actor: string) => {
    handOver(w, SHARED_DEVICE, actor);
    await signInAs(w, actor, 'google');
  }
);

When('{actor} connects Apple', async (w, actor: string) => {
  await w.s.apply(linkProvider, onDevice(w, actor, 'apple'));
});

When('{actor} tries to connect Apple', async (w, actor: string) => {
  await w.s.apply(linkProvider, onDevice(w, actor, 'apple'));
});

When(
  '{actor} tries to connect a second Google account',
  async (w, actor: string) => {
    await w.s.apply(linkProvider, {
      clientId: device(w, actor),
      provider: 'google',
      answers: { ...answers(w, actor, 'google'), email: SECOND_GOOGLE_ACCOUNT },
    });
  }
);

When(
  "{actor} tries to connect {actor}'s Apple account",
  async (w, actor: string, owner: string) => {
    await w.s.apply(linkProvider, {
      clientId: device(w, actor),
      provider: 'apple',
      answers: answers(w, owner, 'apple'),
    });
  }
);

Then(
  '{actor} is told the account already has Google',
  async (w, actor: string) => {
    await expectTold(w, actor, AUTH_ERROR.providerAlreadyLinked);
  }
);

Then(
  '{actor} is told that Apple account belongs to another account',
  async (w, actor: string) => {
    await expectTold(w, actor, AUTH_ERROR.identityAlreadyLinked);
  }
);

Then('{actor} is told connecting failed', async (w, actor: string) => {
  expect((await w.s.read(lastOutcome, device(w, actor)))?.kind).toBe('failed');
});

Then(
  "{actor}'s sign-in methods are (still )Google",
  async (w, actor: string) => {
    expect(await methodsOf(w, actor)).toEqual(['google']);
  }
);

Then(
  "{actor}'s sign-in methods are Google and Apple",
  async (w, actor: string) => {
    expect(await methodsOf(w, actor)).toEqual(['apple', 'google']);
  }
);

When('{actor} removes Apple from their account', async (w, actor: string) => {
  await w.s.apply(unlinkProvider, {
    clientId: device(w, actor),
    provider: 'apple',
  });
});

When(
  '{actor} tries to remove Google from their account',
  async (w, actor: string) => {
    await w.s.apply(unlinkProvider, {
      clientId: device(w, actor),
      provider: 'google',
    });
  }
);

Then(
  '{actor} is told the last sign-in method cannot be removed',
  async (w, actor: string) => {
    await expectTold(w, actor, AUTH_ERROR.lastIdentity);
  }
);

// --- Connection and stolen sign-ins -------------------------------------------

Given("{actor}'s device has lost its connection", async (w, actor: string) => {
  await w.s.apply(setOnline, { clientId: device(w, actor), online: false });
});

Given("{actor}'s device is back online", async (w, actor: string) => {
  await w.s.apply(setOnline, { clientId: device(w, actor), online: true });
});

async function stealSignIn(w: SignInWorld, thief: string, victim: string) {
  await w.s.apply(stealBearer, {
    from: device(w, victim),
    to: device(w, thief),
  });
}

Given("{actor} has stolen {actor}'s sign-in", stealSignIn);

When("{actor} steals {actor}'s sign-in", stealSignIn);

When('{actor} signs out', async (w, actor: string) => {
  await w.s.apply(signOut, device(w, actor));
});

When('{actor} signs out everywhere', async (w, actor: string) => {
  await w.s.apply(signOutEverywhere, device(w, actor));
});

Then(
  "{actor} is (still )signed into {actor}'s account",
  async (w, actor: string, owner: string) => {
    expect(await signedIn(w, actor)).toBe(accountOf(w, owner));
  }
);

// --- Time --------------------------------------------------------------------

When('{int} days pass', async (w, days: number) => {
  await w.s.advanceTime(days * DAY_MS);
});

// --- At Google and Apple ------------------------------------------------------

Given('{actor} has deleted their Apple account', async (w, actor: string) => {
  await signInAs(w, actor, 'apple');
  await w.s.apply(appleAccountDeleted, emailOf(actor, 'apple'));
});

When('{actor} deletes their Apple account', async (w, actor: string) => {
  await w.s.apply(appleAccountDeleted, emailOf(actor, 'apple'));
});

When('{actor} stops using Sign in with Apple', async (w, actor: string) => {
  await w.s.apply(appleConsentRevoked, emailOf(actor, 'apple'));
});

Given(
  '{actor} has stopped using Sign in with Apple',
  async (w, actor: string) => {
    await signInAs(w, actor, 'apple');
    await w.s.apply(appleConsentRevoked, emailOf(actor, 'apple'));
    if ((await signedIn(w, actor)) !== null) {
      throw new Error(`setup: ${actor} is still signed in`);
    }
  }
);

Given(
  '{actor} has changed the email address of their Google account',
  async (w, actor: string) => {
    await w.s.apply(googleEmailChanged, emailOf(actor, 'google'));
    w.moved.set(`${actor}:google`, movedGoogleEmail(emailOf(actor, 'google')));
  }
);

async function forwarding(w: SignInWorld, actor: string, on: boolean) {
  await w.s.apply(appleRelayForwarding, {
    email: emailOf(actor, 'apple'),
    forwarding: on,
  });
}

Given(
  'Apple has stopped forwarding mail to {actor}',
  async (w, actor: string) => {
    await forwarding(w, actor, false);
  }
);

When('Apple stops forwarding mail to {actor}', async (w, actor: string) => {
  await forwarding(w, actor, false);
});

When('Apple forwards mail to {actor} again', async (w, actor: string) => {
  await forwarding(w, actor, true);
});

Then(
  "{actor}'s Google sign-in method shows their new email address",
  async (w, actor: string) => {
    expect((await methodOf(w, actor, 'google'))?.email).toBe(
      currentEmailOf(w, actor, 'google')
    );
    expect(currentEmailOf(w, actor, 'google')).not.toBe(
      emailOf(actor, 'google')
    );
  }
);

Then(
  "{actor}'s Apple sign-in method shows a private Apple email address",
  async (w, actor: string) => {
    const apple = await methodOf(w, actor, 'apple');
    expect(apple?.isPrivateEmail).toBe(true);
    expect(apple?.email).not.toBe(emailOf(actor, 'apple'));
  }
);

Then(
  "{actor}'s Apple sign-in method shows mail is forwarded",
  async (w, actor: string) => {
    expect((await methodOf(w, actor, 'apple'))?.emailForwarding).toBe(true);
  }
);

Then(
  "{actor}'s Apple sign-in method shows mail is not forwarded",
  async (w, actor: string) => {
    expect((await methodOf(w, actor, 'apple'))?.emailForwarding).toBe(false);
  }
);

// --- Google or Apple having trouble -----------------------------------------

/** The provider fault that stops each provider telling the app who signs in. */
const TROUBLE: Readonly<Record<OauthProviderId, string>> = {
  google: 'google.token-500',
  apple: 'apple.token-500',
};

Given('{provider} is having trouble', async (w, provider: OauthProviderId) => {
  await w.s.apply(setProviderFault, TROUBLE[provider]);
});

Given(
  '{actor} tried to sign in with {provider} while it was having trouble',
  async (w, actor: string, provider: OauthProviderId) => {
    await w.s.apply(setProviderFault, TROUBLE[provider]);
    await w.s.apply(signIn, onDevice(w, actor, provider));
    await expectTold(w, actor, AUTH_ERROR.providerFailed);
  }
);

Given('{provider} has recovered', async (w, provider: OauthProviderId) => {
  await w.s.apply(clearProviderFaults, provider);
});

Then(
  '{actor} is told signing in with {provider} failed',
  async (w, actor: string, _provider: OauthProviderId) => {
    await expectTold(w, actor, AUTH_ERROR.providerFailed);
  }
);

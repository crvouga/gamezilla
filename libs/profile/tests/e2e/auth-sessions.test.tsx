/**
 * Sessions end the ways they should: signing out of every device, the
 * account holder stopping Apple sign-in for the app or deleting their Apple
 * Account — and the account survives what it should.
 */

import { describe, expect, test } from 'bun:test';
import {
  appleDeletesAccount,
  appleRevokesApp,
  connectSignInMethod,
  focusActor,
  serverSignInMethodsOf,
  signedInAccountOf,
  signInWithApple,
  signInWithGoogle,
  signInWithGoogleAsAccount,
  signOutEverywhere,
} from '@libs/sim-harness';

import { Handles } from '@libs/test-ids';
import { signedInAs } from './support/auth-reads';
import { openSim } from './support/open-profile-sim';

const WAIT = { maxMs: 20_000 };
/** A device re-checks its session every minute; allow two checks. */
const NOTICE = { maxMs: 150_000, stepMs: 5_000 };

type Sim = Awaited<ReturnType<typeof openSim>>;

/** The device itself shows it is signed out (not just the server). */
async function deviceNoticesSignOut(s: Sim, actorId: string): Promise<void> {
  await s.until(
    async (surf) =>
      (await surf.actors
        .get(actorId)
        ?.ui.get(Handles.accountSignIn)
        .isVisible()) ?? false,
    { ...NOTICE, pred: (shown) => shown }
  );
}

describe('ending sessions', () => {
  test('sign out of all devices ends the other device too', async () => {
    await using s = await openSim('auth-sign-out-everywhere');
    await s.apply(signInWithGoogle, 'alice');
    const account = await signedInAs(s, 'alice');
    await s.apply(signInWithGoogleAsAccount, 'bob', 'alice');
    expect(await signedInAs(s, 'bob')).toBe(account);
    await s.apply(signOutEverywhere, 'alice');
    expect(await s.read(signedInAccountOf, 'alice')).toBeNull();
    expect(await s.read(signedInAccountOf, 'bob')).toBeNull();
    await s.apply(focusActor, 'bob');
    await deviceNoticesSignOut(s, 'bob');
  });

  test('stopping Apple sign-in for the app signs the account out; Apple still gets back in', async () => {
    await using s = await openSim('auth-apple-revoke');
    await s.apply(signInWithApple, 'alice');
    const account = await signedInAs(s, 'alice');
    await s.apply(appleRevokesApp, 'alice');
    expect(await s.read(signedInAccountOf, 'alice')).toBeNull();
    await deviceNoticesSignOut(s, 'alice');
    await s.apply(signInWithApple, 'alice');
    expect(await signedInAs(s, 'alice')).toBe(account);
  });

  test('deleting the only Apple Account ends its sessions', async () => {
    await using s = await openSim('auth-apple-delete-only');
    await s.apply(signInWithApple, 'alice', { account: 'icloud' });
    const account = await signedInAs(s, 'alice');
    await s.apply(appleDeletesAccount, 'alice', 'icloud');
    expect(await s.read(signedInAccountOf, 'alice')).toBeNull();
    expect(await s.read(serverSignInMethodsOf, account)).toEqual([]);
    await deviceNoticesSignOut(s, 'alice');
  });

  test('deleting a linked Apple Account keeps the account and its Google sign-in', async () => {
    await using s = await openSim('auth-apple-delete-linked');
    await s.apply(signInWithGoogle, 'alice');
    const account = await signedInAs(s, 'alice');
    await s.apply(connectSignInMethod, 'alice', 'apple');
    await s.until((surf) => serverSignInMethodsOf(surf, account), {
      ...WAIT,
      pred: (methods) => methods.join(',') === 'apple,google',
    });
    await s.apply(appleDeletesAccount, 'alice', 'icloud');
    await s.until((surf) => serverSignInMethodsOf(surf, account), {
      ...WAIT,
      pred: (methods) => methods.join(',') === 'google',
    });
    expect(await s.read(signedInAccountOf, 'alice')).toBe(account);
  });
});

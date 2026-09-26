/**
 * Account linking through the product UI: connecting and removing sign-in
 * methods on the account screen, the refusals a person can hit, and the
 * "Connect your accounts?" decision when an address matches without both
 * providers vouching for it.
 */

import { describe, expect, test } from 'bun:test';
import {
  confirmAccountLink,
  connectSignInMethod,
  keepSeparateAccount,
  localSignInMethodsOf,
  removeSignInMethod,
  seedProviderAccount,
  serverSignInMethodsOf,
  signedInAccountOf,
  signInWithApple,
  signInWithGoogle,
  signInWithProviderAs,
  signOut,
} from '@libs/sim-harness';
import { Handles } from '@libs/test-ids';
import { signedInAs } from './support/auth-reads';
import { openSim } from './support/open-profile-sim';

const WAIT = { maxMs: 20_000 };
const UNVERIFIED = 'uma@unverified.test';

async function seedUnverifiedPair(
  s: Awaited<ReturnType<typeof openSim>>
): Promise<void> {
  // Google never verified uma's address; Apple did.
  await s.apply(seedProviderAccount, 'google', {
    handle: 'uma',
    email: UNVERIFIED,
    emailVerified: false,
  });
  await s.apply(seedProviderAccount, 'apple', {
    handle: 'uma',
    email: UNVERIFIED,
  });
}

describe('sign-in methods on the account screen', () => {
  test('connect Apple, sign in with it, then remove it', async () => {
    await using s = await openSim('auth-link-connect-remove');
    await s.apply(signInWithGoogle, 'alice');
    const account = await signedInAs(s, 'alice');
    await s.apply(connectSignInMethod, 'alice', 'apple', { hideEmail: true });
    await s.until((surf) => localSignInMethodsOf(surf, 'alice'), {
      ...WAIT,
      pred: (methods) => methods.join(',') === 'apple,google',
    });
    expect(await s.read(serverSignInMethodsOf, account)).toEqual([
      'apple',
      'google',
    ]);
    expect(await s.read(signedInAccountOf, 'alice')).toBe(account);

    await s.apply(signOut, 'alice');
    await s.apply(signInWithApple, 'alice', { account: 'icloud' });
    expect(await signedInAs(s, 'alice')).toBe(account);

    await s.apply(removeSignInMethod, 'alice', 'apple');
    await s.until((surf) => localSignInMethodsOf(surf, 'alice'), {
      ...WAIT,
      pred: (methods) => methods.join(',') === 'google',
    });
    expect(await s.read(serverSignInMethodsOf, account)).toEqual(['google']);
  });

  test('the only sign-in method cannot be removed', async () => {
    await using s = await openSim('auth-link-last');
    await s.apply(signInWithGoogle, 'alice');
    await s.until((surf) => localSignInMethodsOf(surf, 'alice'), {
      ...WAIT,
      pred: (methods) => methods.join(',') === 'google',
    });
    // The button is there but disabled: tapping it opens no confirmation.
    const ui = await s.read((surf) => surf.actors.get('alice')?.ui);
    await ui?.get(Handles.accountUnlinkProvider('google')).tap();
    expect(await ui?.get(Handles.accountUnlinkConfirm).isVisible()).toBe(false);
    expect(await s.read(localSignInMethodsOf, 'alice')).toEqual(['google']);
  });

  test("an Apple Account that belongs to another account can't be connected", async () => {
    await using s = await openSim('auth-link-taken');
    // alice's iCloud Apple Account signs in on its own: a separate account.
    await s.apply(signInWithApple, 'alice', { account: 'icloud' });
    await signedInAs(s, 'alice');
    await s.apply(signOut, 'alice');
    await s.apply(signInWithGoogle, 'alice');
    const account = await signedInAs(s, 'alice');
    await s.apply(connectSignInMethod, 'alice', 'apple', { account: 'icloud' });
    await s.until(
      async (surf) =>
        (await surf.actors
          .get('alice')
          ?.ui.get(Handles.accountSignInMethod('apple'))
          .text()) ?? '',
      {
        ...WAIT,
        pred: (text) =>
          text.includes('already signs in to a different account'),
      }
    );
    expect(await s.read(serverSignInMethodsOf, account)).toEqual(['google']);
  });
});

describe('an address match that must be proven', () => {
  test('confirm: signing in to the existing account connects Apple to it', async () => {
    await using s = await openSim('auth-pending-confirm');
    await seedUnverifiedPair(s);
    await s.apply(signInWithProviderAs, 'alice', {
      provider: 'google',
      email: UNVERIFIED,
    });
    const uma = await signedInAs(s, 'alice');
    await s.apply(signOut, 'alice');
    await s.apply(signInWithProviderAs, 'alice', {
      provider: 'apple',
      email: UNVERIFIED,
    });
    await s.until(
      async (surf) =>
        (await surf.actors
          .get('alice')
          ?.ui.get(Handles.authLinkRequired)
          .isVisible()) ?? false,
      { ...WAIT, pred: (shown) => shown }
    );
    expect(await s.read(signedInAccountOf, 'alice')).toBeNull();
    await s.apply(confirmAccountLink, 'alice', 'google', UNVERIFIED);
    expect(await signedInAs(s, 'alice')).toBe(uma);
    expect(await s.read(serverSignInMethodsOf, uma)).toEqual([
      'apple',
      'google',
    ]);
  });

  test('keep separate: the new sign-in becomes its own account', async () => {
    await using s = await openSim('auth-pending-separate');
    await seedUnverifiedPair(s);
    await s.apply(signInWithProviderAs, 'alice', {
      provider: 'google',
      email: UNVERIFIED,
    });
    const uma = await signedInAs(s, 'alice');
    await s.apply(signOut, 'alice');
    await s.apply(signInWithProviderAs, 'alice', {
      provider: 'apple',
      email: UNVERIFIED,
    });
    await s.until(
      async (surf) =>
        (await surf.actors
          .get('alice')
          ?.ui.get(Handles.authLinkRequired)
          .isVisible()) ?? false,
      { ...WAIT, pred: (shown) => shown }
    );
    await s.apply(keepSeparateAccount, 'alice');
    const separate = await signedInAs(s, 'alice');
    expect(separate).not.toBe(uma);
    expect(await s.read(serverSignInMethodsOf, uma)).toEqual(['google']);
    expect(await s.read(serverSignInMethodsOf, separate)).toEqual(['apple']);
  });
});

/**
 * Sign in with Apple (non-production, against the simulated Apple provider):
 * a first sign-in, the same person arriving through Google and Apple with one
 * verified address, and Hide My Email keeping them apart.
 */

import { describe, expect, test } from 'bun:test';
import {
  localSignInMethodsOf,
  returnToTabs,
  serverSignInMethodsOf,
  signInWithApple,
  signInWithGoogle,
  signOut,
} from '@libs/sim-harness';
import { signedInAs } from './support/auth-reads';
import { openSim } from './support/open-profile-sim';

const WAIT = { maxMs: 20_000 };

describe('Sign in with Apple', () => {
  test('a first sign-in with Apple makes an account that lists Apple', async () => {
    await using s = await openSim('auth-apple-first');
    await s.apply(signInWithApple, 'alice');
    const account = await signedInAs(s, 'alice');
    expect(await s.read(serverSignInMethodsOf, account)).toEqual(['apple']);
    await s.until((surf) => localSignInMethodsOf(surf, 'alice'), {
      ...WAIT,
      pred: (methods) => methods.join(',') === 'apple',
    });
  });

  test('Google then Apple with the same verified address is one account', async () => {
    await using s = await openSim('auth-apple-same-address');
    await s.apply(signInWithGoogle, 'alice');
    const viaGoogle = await signedInAs(s, 'alice');
    await s.apply(signOut, 'alice');
    await s.apply(signInWithApple, 'alice', { account: 'gmail' });
    const viaApple = await signedInAs(s, 'alice');
    expect(viaApple).toBe(viaGoogle);
    expect(await s.read(serverSignInMethodsOf, viaApple)).toEqual([
      'apple',
      'google',
    ]);
    await s.until((surf) => localSignInMethodsOf(surf, 'alice'), {
      ...WAIT,
      pred: (methods) => methods.join(',') === 'apple,google',
    });
  });

  test('Hide My Email is a separate account until linked', async () => {
    await using s = await openSim('auth-apple-hidden');
    await s.apply(signInWithGoogle, 'alice');
    const viaGoogle = await signedInAs(s, 'alice');
    await s.apply(signOut, 'alice');
    await s.apply(signInWithApple, 'alice', {
      account: 'icloud',
      hideEmail: true,
    });
    const viaApple = await signedInAs(s, 'alice');
    expect(viaApple).not.toBe(viaGoogle);
    await s.apply(returnToTabs, 'alice');
  });
});

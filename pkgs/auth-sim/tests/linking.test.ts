import { describe, expect, test } from 'bun:test';
import {
  auth,
  confirmPendingLink,
  declinePendingLink,
  identitiesOf,
  invariantViolations,
  lastOutcome,
  linkProvider,
  prepareLink,
  signedInUser,
  signIn,
  signOut,
  unlinkProvider,
} from '@pkgs/auth-sim';

import { step } from './support';

describe('auth sim: the same person through two providers', () => {
  test('a verified address shared by Google and Apple is one account', async () => {
    await using s = await auth.run({ seed: 101 });
    await s.apply(signIn, step('c0', 'google', 'chris@gmail.com'));
    const viaGoogle = await s.read(signedInUser, 'c0');
    await s.apply(signIn, step('c1', 'apple', 'chris@gmail.com'));
    expect(await s.read(signedInUser, 'c1')).toBe(viaGoogle);
    const providers = (await s.read(identitiesOf, 'c1')).map(
      (row) => row.provider
    );
    expect(providers.sort()).toEqual(['apple', 'google']);
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('Apple first, Google second: still one account', async () => {
    await using s = await auth.run({ seed: 102 });
    await s.apply(signIn, step('c0', 'apple', 'chris@gmail.com'));
    await s.apply(signIn, step('c1', 'google', 'chris@gmail.com'));
    expect(await s.read(signedInUser, 'c1')).toBe(
      await s.read(signedInUser, 'c0')
    );
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('Hide My Email never links by address', async () => {
    await using s = await auth.run({ seed: 103 });
    await s.apply(signIn, step('c0', 'google', 'chris@gmail.com'));
    await s.apply(
      signIn,
      step('c1', 'apple', 'chris@gmail.com', { emailChoice: 'hide' })
    );
    expect(await s.read(signedInUser, 'c1')).not.toBe(
      await s.read(signedInUser, 'c0')
    );
    const [apple] = await s.read(identitiesOf, 'c1');
    expect(apple?.isPrivateEmail).toBe(true);
    expect(apple?.email).toMatch(/@privaterelay\.appleid\.com$/);
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('an unverified match must be proven: confirm links it', async () => {
    await using s = await auth.run({ seed: 104 });
    await s.apply(signIn, step('c0', 'google', 'uma@unverified.test'));
    const uma = await s.read(signedInUser, 'c0');
    await s.apply(signIn, step('c1', 'apple', 'uma@unverified.test'));
    expect((await s.read(lastOutcome, 'c1'))?.kind).toBe('link_required');
    expect(await s.read(signedInUser, 'c1')).toBeNull();
    await s.apply(
      confirmPendingLink,
      step('c1', 'google', 'uma@unverified.test')
    );
    expect(await s.read(lastOutcome, 'c1')).toEqual({ kind: 'ok' });
    expect(await s.read(signedInUser, 'c1')).toBe(uma);
    await s.apply(signIn, step('c1', 'apple', 'uma@unverified.test'));
    expect(await s.read(signedInUser, 'c1')).toBe(uma);
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('an unverified match can be declined: a separate account', async () => {
    await using s = await auth.run({ seed: 105 });
    await s.apply(signIn, step('c0', 'google', 'uma@unverified.test'));
    await s.apply(signIn, step('c1', 'apple', 'uma@unverified.test'));
    await s.apply(declinePendingLink, 'c1');
    expect(await s.read(lastOutcome, 'c1')).toEqual({ kind: 'ok' });
    expect(await s.read(signedInUser, 'c1')).not.toBe(
      await s.read(signedInUser, 'c0')
    );
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('proving with the wrong account discards the pending link', async () => {
    await using s = await auth.run({ seed: 106 });
    await s.apply(signIn, step('c0', 'google', 'uma@unverified.test'));
    await s.apply(signIn, step('c0', 'google', 'bob@gmail.com'));
    await s.apply(signIn, step('c1', 'apple', 'uma@unverified.test'));
    await s.apply(confirmPendingLink, step('c1', 'google', 'bob@gmail.com'));
    expect(await s.read(lastOutcome, 'c1')).toEqual({
      kind: 'error',
      code: 'link_mismatch',
    });
    expect(await s.read(signedInUser, 'c1')).toBeNull();
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('a pending link expires', async () => {
    await using s = await auth.run({ seed: 107 });
    await s.apply(signIn, step('c0', 'google', 'uma@unverified.test'));
    await s.apply(signIn, step('c1', 'apple', 'uma@unverified.test'));
    await s.advanceTime(11 * 60 * 1000);
    await s.apply(
      confirmPendingLink,
      step('c1', 'google', 'uma@unverified.test')
    );
    expect(await s.read(lastOutcome, 'c1')).toEqual({
      kind: 'error',
      code: 'expired',
    });
    expect(await s.read(invariantViolations)).toEqual([]);
  });
});

describe('auth sim: managing sign-in methods', () => {
  test('link Apple to a Google account, then sign in with either', async () => {
    await using s = await auth.run({ seed: 111 });
    await s.apply(signIn, step('c0', 'google', 'alice@gmail.com'));
    const alice = await s.read(signedInUser, 'c0');
    await s.apply(
      linkProvider,
      step('c0', 'apple', 'alice@icloud.com', { emailChoice: 'hide' })
    );
    expect(await s.read(lastOutcome, 'c0')).toEqual({ kind: 'ok' });
    expect(await s.read(signedInUser, 'c0')).toBe(alice);
    await s.apply(signIn, step('c1', 'apple', 'alice@icloud.com'));
    expect(await s.read(signedInUser, 'c1')).toBe(alice);
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('an identity that belongs to someone else cannot be linked', async () => {
    await using s = await auth.run({ seed: 112 });
    await s.apply(signIn, step('c0', 'apple', 'dan@icloud.com'));
    await s.apply(signIn, step('c1', 'google', 'bob@gmail.com'));
    await s.apply(linkProvider, step('c1', 'apple', 'dan@icloud.com'));
    expect(await s.read(lastOutcome, 'c1')).toEqual({
      kind: 'error',
      code: 'identity_already_linked',
    });
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('a link ticket minted for one session never serves another', async () => {
    await using s = await auth.run({ seed: 115 });
    await s.apply(signIn, step('c0', 'apple', 'dan@icloud.com'));
    const dan = await s.read(signedInUser, 'c0');
    await s.apply(prepareLink, 'c0');
    await s.apply(signOut, 'c0');
    await s.apply(signIn, step('c0', 'google', 'alice@gmail.com'));
    const alice = await s.read(signedInUser, 'c0');
    await s.apply(linkProvider, step('c0', 'apple', 'dan@icloud.com'));
    expect(await s.read(lastOutcome, 'c0')).toEqual({
      kind: 'error',
      code: 'identity_already_linked',
    });
    expect(await s.read(signedInUser, 'c0')).toBe(alice);
    expect(alice).not.toBe(dan);
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('one identity per provider', async () => {
    await using s = await auth.run({ seed: 113 });
    await s.apply(signIn, step('c0', 'google', 'alice@gmail.com'));
    await s.apply(linkProvider, step('c0', 'google', 'bob@gmail.com'));
    expect(await s.read(lastOutcome, 'c0')).toEqual({
      kind: 'error',
      code: 'provider_already_linked',
    });
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('unlink: never the last method; the unlinked one starts fresh', async () => {
    await using s = await auth.run({ seed: 114 });
    await s.apply(signIn, step('c0', 'google', 'alice@gmail.com'));
    const alice = await s.read(signedInUser, 'c0');
    await s.apply(unlinkProvider, { clientId: 'c0', provider: 'google' });
    expect(await s.read(lastOutcome, 'c0')).toEqual({
      kind: 'error',
      code: 'last_identity',
    });
    await s.apply(linkProvider, step('c0', 'apple', 'alice@icloud.com'));
    await s.apply(unlinkProvider, { clientId: 'c0', provider: 'apple' });
    expect(await s.read(lastOutcome, 'c0')).toEqual({ kind: 'ok' });
    await s.apply(signIn, step('c1', 'apple', 'alice@icloud.com'));
    expect(await s.read(signedInUser, 'c1')).not.toBe(alice);
    expect(await s.read(invariantViolations)).toEqual([]);
  });
});

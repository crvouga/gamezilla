import { describe, expect, test } from 'bun:test';
import {
  appleAccountDeleted,
  appleConsentRevoked,
  appleRelayForwarding,
  auth,
  clearProviderFaults,
  googleEmailChanged,
  identitiesOf,
  invariantViolations,
  lastOutcome,
  linkProvider,
  rotateProviderKeys,
  setProviderFault,
  signedInUser,
  signIn,
} from '@pkgs/auth-sim';

import { step } from './support';

describe('auth sim: the account holder acts at the provider', () => {
  test('revoking the app at Apple signs the account out everywhere', async () => {
    await using s = await auth.run({ seed: 301 });
    await s.apply(signIn, step('c0', 'apple', 'dan@icloud.com'));
    const dan = await s.read(signedInUser, 'c0');
    await s.apply(appleConsentRevoked, 'dan@icloud.com');
    expect(await s.read(signedInUser, 'c0')).toBeNull();
    // Signing in again is a first authorization for Apple, same account here.
    await s.apply(signIn, step('c0', 'apple', 'dan@icloud.com'));
    expect(await s.read(signedInUser, 'c0')).toBe(dan);
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('deleting the Apple Account: the only way in is gone, so is the session', async () => {
    await using s = await auth.run({ seed: 302 });
    await s.apply(signIn, step('c0', 'apple', 'dan@icloud.com'));
    await s.apply(appleAccountDeleted, 'dan@icloud.com');
    expect(await s.read(signedInUser, 'c0')).toBeNull();
    await s.apply(signIn, step('c0', 'apple', 'dan@icloud.com'));
    expect(await s.read(lastOutcome, 'c0')).toEqual({
      kind: 'error',
      code: 'cancelled',
    });
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('deleting the Apple Account keeps a session that has Google too', async () => {
    await using s = await auth.run({ seed: 303 });
    await s.apply(signIn, step('c0', 'google', 'alice@gmail.com'));
    await s.apply(linkProvider, step('c0', 'apple', 'alice@icloud.com'));
    await s.apply(appleAccountDeleted, 'alice@icloud.com');
    expect(await s.read(signedInUser, 'c0')).not.toBeNull();
    const providers = (await s.read(identitiesOf, 'c0')).map(
      (row) => row.provider
    );
    expect(providers).toEqual(['google']);
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('relay forwarding switched off at Apple is recorded', async () => {
    await using s = await auth.run({ seed: 304 });
    await s.apply(
      signIn,
      step('c0', 'apple', 'dan@icloud.com', { emailChoice: 'hide' })
    );
    await s.apply(appleRelayForwarding, {
      email: 'dan@icloud.com',
      forwarding: false,
    });
    const [apple] = await s.read(identitiesOf, 'c0');
    expect(apple?.emailForwarding).toBe(false);
    await s.apply(appleRelayForwarding, {
      email: 'dan@icloud.com',
      forwarding: true,
    });
    expect((await s.read(identitiesOf, 'c0'))[0]?.emailForwarding).toBe(true);
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('a changed Google address keeps the account and updates the identity', async () => {
    await using s = await auth.run({ seed: 305 });
    await s.apply(signIn, step('c0', 'google', 'bob@gmail.com'));
    const bob = await s.read(signedInUser, 'c0');
    await s.apply(googleEmailChanged, 'bob@gmail.com');
    await s.apply(signIn, step('c0', 'google', 'bob.moved@gmail.com'));
    expect(await s.read(signedInUser, 'c0')).toBe(bob);
    expect((await s.read(identitiesOf, 'c0'))[0]?.email).toBe(
      'bob.moved@gmail.com'
    );
    expect(await s.read(invariantViolations)).toEqual([]);
  });
});

describe('auth sim: providers misbehaving', () => {
  const failing = [
    ['google.token-500', 'google', 'alice@gmail.com'],
    ['google.invalid-client', 'google', 'alice@gmail.com'],
    ['google.userinfo-500', 'google', 'alice@gmail.com'],
    ['google.userinfo-401', 'google', 'alice@gmail.com'],
    ['apple.token-500', 'apple', 'dan@icloud.com'],
    ['apple.unknown-key', 'apple', 'dan@icloud.com'],
    ['apple.token-stale-2h', 'apple', 'dan@icloud.com'],
    ['apple.clock-ahead-10m', 'apple', 'dan@icloud.com'],
  ] as const;
  for (const [fault, provider, email] of failing) {
    test(`${fault}: sign-in fails, nothing changes, and recovers`, async () => {
      await using s = await auth.run({ seed: 311 });
      await s.apply(setProviderFault, fault);
      await s.apply(signIn, step('c0', provider, email));
      expect(await s.read(lastOutcome, 'c0')).toEqual({
        kind: 'error',
        code: 'provider_failed',
      });
      await s.apply(clearProviderFaults, provider);
      await s.apply(signIn, step('c0', provider, email));
      expect(await s.read(lastOutcome, 'c0')).toEqual({ kind: 'ok' });
      expect(await s.read(invariantViolations)).toEqual([]);
    });
  }

  const tolerated = ['apple.string-booleans', 'apple.clock-ahead-2m'] as const;
  for (const fault of tolerated) {
    test(`${fault}: tolerated`, async () => {
      await using s = await auth.run({ seed: 312 });
      await s.apply(setProviderFault, fault);
      await s.apply(signIn, step('c0', 'apple', 'chris@gmail.com'));
      expect(await s.read(lastOutcome, 'c0')).toEqual({ kind: 'ok' });
      expect(await s.read(invariantViolations)).toEqual([]);
    });
  }

  test('a denied consent is a cancellation', async () => {
    await using s = await auth.run({ seed: 313 });
    await s.apply(
      signIn,
      step('c0', 'apple', 'dan@icloud.com', { consent: 'deny' })
    );
    expect(await s.read(lastOutcome, 'c0')).toEqual({
      kind: 'error',
      code: 'cancelled',
    });
    expect(await s.read(invariantViolations)).toEqual([]);
  });

  test('key rotation: the relying party refetches the JWKS', async () => {
    await using s = await auth.run({ seed: 314 });
    await s.apply(signIn, step('c0', 'apple', 'dan@icloud.com'));
    await s.apply(rotateProviderKeys, 'apple');
    await s.apply(signIn, step('c1', 'apple', 'dan@icloud.com'));
    expect(await s.read(lastOutcome, 'c1')).toEqual({ kind: 'ok' });
    expect(await s.read(invariantViolations)).toEqual([]);
  });
});

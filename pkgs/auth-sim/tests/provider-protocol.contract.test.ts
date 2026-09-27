/**
 * Contract: how the in-house relying party treats each way a provider's
 * answers can go wrong on the wire — a failing token or userinfo exchange,
 * an unknown client, an ID token signed with a key it never published, one
 * issued two hours ago or ten minutes in the future — and the quirks it
 * must tolerate (Apple's booleans as strings, two minutes of clock skew,
 * signing keys rotated between sign-ins). The behavior a person sees
 * ("signing in while Google is failing fails and changes nothing, and works
 * once it recovers") is `specs/sign-in/failing-provider.feature`; this is
 * the full case table under it.
 */

import { describe, expect, test } from 'bun:test';
import { AUTH_ERROR, type OauthProviderId } from '@pkgs/auth/shared';
import {
  auth,
  clearProviderFaults,
  invariantViolations,
  lastOutcome,
  type ProviderStepArgs,
  rotateProviderKeys,
  setProviderFault,
  signIn,
} from '@pkgs/auth-sim';

function signingIn(
  clientId: string,
  provider: OauthProviderId,
  email: string
): ProviderStepArgs {
  return {
    clientId,
    provider,
    answers: { email, consent: 'allow', emailChoice: 'share' },
  };
}

const FAILING = [
  ['google.token-500', 'google', 'alice@gmail.com'],
  ['google.invalid-client', 'google', 'alice@gmail.com'],
  ['google.userinfo-500', 'google', 'alice@gmail.com'],
  ['google.userinfo-401', 'google', 'alice@gmail.com'],
  ['apple.token-500', 'apple', 'dan@icloud.com'],
  ['apple.unknown-key', 'apple', 'dan@icloud.com'],
  ['apple.token-stale-2h', 'apple', 'dan@icloud.com'],
  ['apple.clock-ahead-10m', 'apple', 'dan@icloud.com'],
] as const;

const TOLERATED = ['apple.string-booleans', 'apple.clock-ahead-2m'] as const;

describe('provider answers the relying party refuses', () => {
  for (const [fault, provider, email] of FAILING) {
    test(`${fault}: provider_failed, then signs in once cleared`, async () => {
      await using s = await auth.run({ seed: 311 });
      await s.apply(setProviderFault, fault);
      await s.apply(signIn, signingIn('c0', provider, email));
      expect(await s.read(lastOutcome, 'c0')).toEqual({
        kind: 'error',
        code: AUTH_ERROR.providerFailed,
      });
      await s.apply(clearProviderFaults, provider);
      await s.apply(signIn, signingIn('c0', provider, email));
      expect(await s.read(lastOutcome, 'c0')).toEqual({ kind: 'ok' });
      expect(await s.read(invariantViolations)).toEqual([]);
    });
  }
});

describe('provider quirks the relying party tolerates', () => {
  for (const fault of TOLERATED) {
    test(`${fault}: signs in`, async () => {
      await using s = await auth.run({ seed: 312 });
      await s.apply(setProviderFault, fault);
      await s.apply(signIn, signingIn('c0', 'apple', 'chris@gmail.com'));
      expect(await s.read(lastOutcome, 'c0')).toEqual({ kind: 'ok' });
      expect(await s.read(invariantViolations)).toEqual([]);
    });
  }

  test('rotated signing keys: the relying party fetches the new ones', async () => {
    await using s = await auth.run({ seed: 314 });
    await s.apply(signIn, signingIn('c0', 'apple', 'dan@icloud.com'));
    await s.apply(rotateProviderKeys, 'apple');
    await s.apply(signIn, signingIn('c1', 'apple', 'dan@icloud.com'));
    expect(await s.read(lastOutcome, 'c1')).toEqual({ kind: 'ok' });
    expect(await s.read(invariantViolations)).toEqual([]);
  });
});

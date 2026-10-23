/**
 * Provider protocol contract of the example app: every way Google or Apple
 * can fail to vouch for someone — a failing token or userinfo endpoint, an
 * unrecognised client, an id_token signed with an unknown key, stale, or
 * issued too far ahead — ends signing in with `provider_failed`, signs
 * nobody in and records no account, and signing in works once the fault
 * clears. Sound but unusual answers (string booleans, a clock two minutes
 * ahead, rotated signing keys) still sign in. The spec states the rule
 * people see ("while Google or Apple is having trouble, signing in fails
 * plainly and changes nothing"); this table is the protocol behind it.
 */

import { describe, expect, test } from 'bun:test';
import type { ProviderStepArgs } from '@pkgs/auth-root-harness-ts/actions';
import {
  AUTH_FAULTS,
  clearProviderFaults,
  rotateProviderKeys,
  setProviderFault,
  signIn,
  signOut,
} from '@pkgs/auth-root-harness-ts/actions';
import {
  accountsOnRecord,
  auth,
  lastOutcome,
  signedInUser,
} from '@pkgs/auth-root-harness-ts/system';
import type { AuthSurface } from '@pkgs/auth-root-harness-ts/types';
import { AUTH_ERROR } from '@pkgs/auth-root-shared-ts/auth-error-code';
import type { OauthProviderId } from '@pkgs/auth-root-shared-ts/sign-in-method';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

/** Booting the example app with its two providers costs ~0.3 s idle. */
const BOOT_TIMEOUT_MS = 30_000;
const DEVICE = 'c0';

const EMAIL: Readonly<Record<OauthProviderId, string>> = {
  google: 'alice@gmail.com',
  apple: 'alice@icloud.com',
};

function signInWith(provider: OauthProviderId): ProviderStepArgs {
  return {
    clientId: DEVICE,
    provider,
    answers: { email: EMAIL[provider], consent: 'allow', emailChoice: 'share' },
  };
}

async function open(seed: string): Promise<Run<AuthSurface>> {
  return await auth.run({
    seed,
    args: { fabric: 'mockingbird-sqlite', clientCount: 1 },
  });
}

/** Each fault that stops a provider vouching for anyone, by its provider. */
const FAILURES: readonly (readonly [string, OauthProviderId])[] = [
  ['google.token-500', 'google'],
  ['google.invalid-client', 'google'],
  ['google.userinfo-500', 'google'],
  ['google.userinfo-401', 'google'],
  ['apple.token-500', 'apple'],
  ['apple.unknown-key', 'apple'],
  ['apple.token-stale-2h', 'apple'],
  ['apple.clock-ahead-10m', 'apple'],
];

/** Unusual answers a provider gives that are still sound. */
const SOUND_QUIRKS: readonly string[] = [
  'apple.string-booleans',
  'apple.clock-ahead-2m',
];

describe('a provider failing to vouch', () => {
  test('every failure mode is a known provider fault', () => {
    for (const [fault] of [...FAILURES, ...SOUND_QUIRKS.map((f) => [f])]) {
      expect(AUTH_FAULTS[fault as string]).toBeDefined();
    }
  });

  for (const [fault, provider] of FAILURES) {
    test(
      `${fault}: signing in fails plainly, changes nothing, and works once it clears`,
      async () => {
        await using s = await open(`provider-failure:${fault}`);
        await s.apply(setProviderFault, fault);
        await s.apply(signIn, signInWith(provider));
        expect(await s.read(lastOutcome, DEVICE)).toEqual({
          kind: 'error',
          code: AUTH_ERROR.providerFailed,
        });
        expect(await s.read(signedInUser, DEVICE)).toBeNull();
        expect(await s.read(accountsOnRecord)).toEqual([]);

        await s.apply(clearProviderFaults, provider);
        await s.apply(signIn, signInWith(provider));
        expect(await s.read(lastOutcome, DEVICE)).toEqual({ kind: 'ok' });
        expect(await s.read(signedInUser, DEVICE)).not.toBeNull();
      },
      BOOT_TIMEOUT_MS
    );
  }
});

describe('a provider vouching in an unusual but sound way', () => {
  for (const fault of SOUND_QUIRKS) {
    test(
      `${fault}: signing in still works`,
      async () => {
        await using s = await open(`provider-quirk:${fault}`);
        await s.apply(setProviderFault, fault);
        await s.apply(signIn, signInWith('apple'));
        expect(await s.read(lastOutcome, DEVICE)).toEqual({ kind: 'ok' });
        expect(await s.read(signedInUser, DEVICE)).not.toBeNull();
      },
      BOOT_TIMEOUT_MS
    );
  }

  test(
    'Apple rotating its signing keys still signs the same account in',
    async () => {
      await using s = await open('provider-quirk:apple-key-rotation');
      await s.apply(signIn, signInWith('apple'));
      const account = await s.read(signedInUser, DEVICE);
      expect(account).not.toBeNull();
      await s.apply(signOut, DEVICE);
      await s.apply(rotateProviderKeys, 'apple');
      await s.apply(signIn, signInWith('apple'));
      expect(await s.read(signedInUser, DEVICE)).toBe(account);
    },
    BOOT_TIMEOUT_MS
  );
});

import { expect, test } from 'bun:test';
import {
  createHarnessIdps,
  type HarnessIdp,
  harnessAppleClientKeys,
  harnessIdpAccountId,
} from '@libs/harness-ts/idp';

async function providers() {
  return createHarnessIdps({
    clock: { now: () => 1_700_000_000_000 },
    appleKeys: await harnessAppleClientKeys(),
    toApi: () => async () => new Response(null, { status: 204 }),
  });
}

async function signingKeys(provider: HarnessIdp): Promise<unknown> {
  const path =
    provider.provider === 'google' ? '/oauth2/v3/certs' : '/auth/keys';
  const response = await provider.fetch(`${provider.origin}${path}`);
  expect(response.ok).toBe(true);
  const keys: unknown = await response.json();
  expect(keys).toMatchObject({ keys: [{ kty: 'RSA', e: 'AQAB' }] });
  return keys;
}

// regression: harness-idp-regenerates-rsa-per-world
test('independent worlds reuse reproducible provider keys with isolated account directories', async () => {
  const first = await providers();
  const second = await providers();
  const googleKeys = await signingKeys(first.google);
  expect(await signingKeys(second.google)).toEqual(googleKeys);
  const appleKeys = await signingKeys(first.apple);
  expect(await signingKeys(second.apple)).toEqual(appleKeys);
  expect(appleKeys).not.toEqual(googleKeys);
  first.google.addAccount({ handle: 'alice', email: 'alice@example.test' });
  const id = harnessIdpAccountId('alice@example.test');
  expect(first.google.runtime.instance().accounts.has(id)).toBe(true);
  expect(second.google.runtime.instance().accounts.has(id)).toBe(false);
  expect(first.apple.runtime.instance().accounts.has(id)).toBe(false);
});

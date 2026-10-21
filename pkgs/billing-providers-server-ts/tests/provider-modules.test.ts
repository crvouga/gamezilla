/**
 * Every provider module is interchangeable with every other: the same shape,
 * the same behaviour when unconfigured, an adapter that answers to the
 * module's id, and secrets that never collide.
 */
import { describe, expect, test } from 'bun:test';
import { PaddleSecretKeys } from '@pkgs/billing-paddle-shared-ts/secret-keys';
import {
  createConfiguredMembershipProviders,
  MEMBERSHIP_PROVIDER_MODULES,
  MembershipProviderConfigError,
} from '@pkgs/billing-providers-server-ts/billing-providers';
import { CONTRACT_OFFER } from '@pkgs/billing-root-shared-ts/contract-fixtures';
import type { MembershipProviderEnv } from '@pkgs/billing-root-shared-ts/provider-module';
import { isMembershipProviderId } from '@pkgs/billing-root-shared-ts/providers';
import { StripeSecretKeys } from '@pkgs/billing-stripe-shared-ts/secret-keys';

function env(secrets: Readonly<Record<string, string>>): MembershipProviderEnv {
  return {
    readSecret: (name) => Promise.resolve(secrets[name] ?? null),
    offer: CONTRACT_OFFER,
    now: () => 0,
    fetch: () => Promise.reject(new Error('no network in this test')),
  };
}

/** Enough configuration to build each provider. */
const CONFIGURED: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  stripe: { [StripeSecretKeys.secretKey]: 'sk_test_x' },
  paddle: { [PaddleSecretKeys.apiKey]: 'pdl_sdbx_apikey_x' },
};

describe('the provider modules', () => {
  test('ids are unique slugs', () => {
    const ids = MEMBERSHIP_PROVIDER_MODULES.map((m) => m.provider);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(isMembershipProviderId(id)).toBe(true);
  });

  test('secret names never collide, and every one is optional', () => {
    const names = MEMBERSHIP_PROVIDER_MODULES.flatMap((m) =>
      m.secrets.map((s) => s.name)
    );
    expect(new Set(names).size).toBe(names.length);
    for (const m of MEMBERSHIP_PROVIDER_MODULES) {
      for (const secret of m.secrets) expect(secret.optional).toBe(true);
    }
  });

  for (const module of MEMBERSHIP_PROVIDER_MODULES) {
    test(`${module.provider}: unconfigured builds nothing`, async () => {
      expect(await module.create(env({}))).toBeNull();
      if (module.reconcile !== undefined) {
        expect(
          await module.reconcile({
            ...env({}),
            callbackUrl: 'https://api.test/cb',
            log: { info: () => {}, warn: () => {} } as never,
          })
        ).toBeNull();
      }
    });

    test(`${module.provider}: configured builds an adapter answering to its id`, async () => {
      const secrets = CONFIGURED[module.provider];
      if (secrets === undefined) {
        throw new Error(`add ${module.provider} to CONFIGURED`);
      }
      const billing = await module.create(env(secrets));
      expect(billing?.provider).toBe(module.provider);
    });
  }
});

describe('createConfiguredMembershipProviders', () => {
  test('any configured subset, with any of it taking checkouts', async () => {
    const ids = Object.keys(CONFIGURED);
    for (let mask = 1; mask < 1 << ids.length; mask += 1) {
      const subset = ids.filter((_, i) => (mask & (1 << i)) !== 0);
      const secrets = Object.assign(
        {},
        ...subset.map((id) => CONFIGURED[id])
      ) as Record<string, string>;
      for (const checkout of subset) {
        const providers = await createConfiguredMembershipProviders({
          env: env(secrets),
          chooseCheckout: () => checkout,
        });
        expect(providers?.checkout.provider).toBe(checkout);
        expect([...(providers?.byId.keys() ?? [])].sort()).toEqual(
          [...subset].sort()
        );
      }
    }
  });

  test('nothing configured is no billing', async () => {
    const providers = await createConfiguredMembershipProviders({
      env: env({}),
      chooseCheckout: (configured) => configured[0] ?? null,
    });
    expect(providers).toBeNull();
  });

  test('a module misconfigured names itself', async () => {
    const misconfigured = {
      provider: 'broken',
      secrets: [],
      create: () => Promise.reject(new Error('half its bindings are set')),
    };
    const result = createConfiguredMembershipProviders({
      env: env({}),
      chooseCheckout: () => null,
      modules: [...MEMBERSHIP_PROVIDER_MODULES, misconfigured],
    });
    await expect(result).rejects.toBeInstanceOf(MembershipProviderConfigError);
    await expect(result).rejects.toThrow('billing provider broken');
  });
});

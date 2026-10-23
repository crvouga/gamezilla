import { describe, expect, mock, test } from 'bun:test';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing-shared-ts/plus-membership-offer';
import type { SyncBillingOfferOptions } from '@libs/billing-shared-ts/sync-billing-offer';
import { syncBillingOffer } from '@libs/billing-shared-ts/sync-billing-offer';
import type { MembershipProviderModule } from '@pkgs/billing-root-shared-ts/provider-module';
import { membershipCallbackPath } from '@pkgs/billing-root-shared-ts/providers';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';

const now = () => 123;
const log = createNoopLogger();

function fixture(values: Record<string, string> = {}) {
  const reconcile = mock(async () => ({ synced: true }));
  const module: MembershipProviderModule = {
    provider: 'test',
    secrets: [],
    create: async () => null,
    reconcile,
  };
  const createSecretReader = mock(
    async () => async (name: string) => values[name]?.trim() || null
  );
  const fetch = mock(async (): Promise<Response> => {
    throw new Error('Billing sync tests must not use the network');
  });
  const options: SyncBillingOfferOptions = {
    production: true,
    createSecretReader,
    modules: [module],
    now,
    fetch,
    log,
  };
  return { options, createSecretReader, reconcile, fetch };
}

describe('billing deployment', () => {
  test('dev validates the offer without provisioned secrets or provider writes', async () => {
    const f = fixture();
    await syncBillingOffer({ ...f.options, production: false });
    expect(f.createSecretReader).not.toHaveBeenCalled();
    expect(f.reconcile).not.toHaveBeenCalled();
    expect(f.fetch).not.toHaveBeenCalled();
  });

  test('dev never reconciles even when provider configuration exists', async () => {
    const f = fixture({ API_URL: 'https://api.example.com' });
    await syncBillingOffer({ ...f.options, production: false });
    expect(f.createSecretReader).not.toHaveBeenCalled();
    expect(f.reconcile).not.toHaveBeenCalled();
  });

  test('production reconciles with the offer, callback and injected I/O', async () => {
    const f = fixture({ API_URL: ' https://api.example.com/ ' });
    await syncBillingOffer(f.options);
    expect(f.createSecretReader).toHaveBeenCalledTimes(1);
    expect(f.reconcile).toHaveBeenCalledWith({
      readSecret: expect.any(Function),
      offer: PLUS_MEMBERSHIP_OFFER,
      callbackUrl: `https://api.example.com${membershipCallbackPath(PLUS_MEMBERSHIP_OFFER, 'test')}`,
      now,
      fetch: f.fetch,
      log,
    });
  });

  test.each([undefined, '', '   '])(
    'production rejects absent or blank API_URL (%j)',
    async (value) => {
      const f = fixture(value === undefined ? {} : { API_URL: value });
      await expect(syncBillingOffer(f.options)).rejects.toThrow(
        'API_URL secret is missing or blank'
      );
      expect(f.reconcile).not.toHaveBeenCalled();
    }
  );

  test('production fails when no provider is configured', async () => {
    const f = fixture({ API_URL: 'https://api.example.com' });
    await expect(
      syncBillingOffer({
        ...f.options,
        modules: [
          {
            provider: 'unconfigured',
            secrets: [],
            create: async () => null,
            reconcile: async () => null,
          },
        ],
      })
    ).rejects.toThrow('no billing provider credentials');
  });

  test('production propagates provider failures', async () => {
    const f = fixture({ API_URL: 'https://api.example.com' });
    f.reconcile.mockRejectedValueOnce(new Error('provider unavailable'));
    await expect(syncBillingOffer(f.options)).rejects.toThrow(
      'provider unavailable'
    );
  });
});

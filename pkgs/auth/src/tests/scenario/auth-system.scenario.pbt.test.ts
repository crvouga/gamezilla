import { describe, expect, test } from 'bun:test';

import {
  AUTH_SESSION_TTL_MS,
  IDP_PROVIDER_DEV,
  IDP_PROVIDER_GOOGLE,
} from '../../shared/auth-constants';
import {
  type AuthArgs,
  auth,
  clientBearers,
  fetchAuth,
  lastStatus,
  migrateSchema,
  oauthApprove,
  oauthStart,
  sessionExchange,
  sessionUser,
  signOut,
  storeFingerprint,
} from './system';
import { AUTH_FABRICS, type AuthFabric } from './types';

const LAUNCH_DEV_URL =
  '/auth/oauth/launch?provider=dev&callbackUrl=http%3A%2F%2Fcallback.test%2Fsso';

function startAuth(
  fabric: AuthFabric,
  seed: number,
  overrides?: Partial<AuthArgs>
) {
  return auth.script({ seed, args: { fabric, ...overrides } });
}

async function signIn(
  s: Awaited<ReturnType<typeof startAuth>>,
  clientId: string,
  provider: typeof IDP_PROVIDER_DEV | typeof IDP_PROVIDER_GOOGLE,
  subject: string
): Promise<void> {
  await s.apply(oauthStart, {
    clientId,
    provider,
    callbackUrl: 'http://callback.test/sso',
  });
  await s.apply(oauthApprove, { clientId, provider, subject });
  await s.apply(sessionExchange, clientId);
}

describe('auth system / PBT', () => {
  for (const fabric of AUTH_FABRICS) {
    test(`dev oauth same subject → same user (${fabric})`, async () => {
      await using s = await startAuth(fabric, 42);
      await signIn(s, 'c0', IDP_PROVIDER_DEV, 'alice');
      await signIn(s, 'c1', IDP_PROVIDER_DEV, 'alice');

      const bearers = await s.observe(clientBearers);
      const b0 = bearers['c0'];
      const b1 = bearers['c1'];
      expect(b0).not.toBeNull();
      expect(b1).not.toBeNull();
      expect(b0).not.toBe(b1);
      const u0 = await s.observe(sessionUser, b0 as string);
      const u1 = await s.observe(sessionUser, b1 as string);
      expect(u0?.externalUserId).toBe(u1?.externalUserId as string);
    }, 60_000);

    test(`session expires as the clock advances (${fabric})`, async () => {
      await using s = await startAuth(fabric, 7);
      await signIn(s, 'c0', IDP_PROVIDER_DEV, 'alice');

      const bearer = (await s.observe(clientBearers))['c0'] as string;
      expect(await s.observe(sessionUser, bearer)).not.toBeNull();
      await s.elapse(AUTH_SESSION_TTL_MS + 1);
      expect(await s.observe(sessionUser, bearer)).toBeNull();
    }, 60_000);

    test(`sign-out invalidates only that session (${fabric})`, async () => {
      await using s = await startAuth(fabric, 9);
      await signIn(s, 'c0', IDP_PROVIDER_DEV, 'alice');
      await signIn(s, 'c1', IDP_PROVIDER_DEV, 'alice');
      const b1 = (await s.observe(clientBearers))['c1'] as string;
      await s.apply(signOut, 'c0');

      expect((await s.observe(clientBearers))['c0']).toBeNull();
      expect(await s.observe(sessionUser, b1)).not.toBeNull();
    }, 60_000);

    test(`google oauth happy path (${fabric})`, async () => {
      await using s = await startAuth(fabric, 11);
      await signIn(s, 'c0', IDP_PROVIDER_GOOGLE, 'g-alice');

      const bearer = (await s.observe(clientBearers))['c0'];
      expect(bearer).not.toBeNull();
      expect(await s.observe(sessionUser, bearer as string)).not.toBeNull();
    }, 60_000);

    test(`dev provider arg off returns 404 on launch (${fabric})`, async () => {
      await using s = await startAuth(fabric, 13, { enableDev: false });
      await s.apply(fetchAuth, {
        path: LAUNCH_DEV_URL,
        init: { method: 'GET', redirect: 'manual' },
      });
      expect(await s.observe(lastStatus)).toBe(404);
    }, 60_000);

    test(`dual-open runs share a fingerprint (${fabric})`, async () => {
      async function once(seed: number): Promise<string> {
        await using s = await startAuth(fabric, seed);
        await signIn(s, 'c0', IDP_PROVIDER_DEV, 'alice');
        return await s.observe(storeFingerprint);
      }
      for (const seed of [1, 2, 3, 4]) {
        expect(await once(seed)).toBe(await once(seed));
      }
    }, 120_000);

    test(`schema migrate is idempotent (${fabric})`, async () => {
      await using s = await startAuth(fabric, 1);
      const before = await s.observe(storeFingerprint);
      await s.apply(migrateSchema);
      expect(await s.observe(storeFingerprint)).toBe(before);
    }, 60_000);
  }

  test('check explores args + library + domain actions', async () => {
    const report = await auth.explore({
      episodes: 4,
      steps: 10,
      seed: 1,
      stopOnViolation: true,
    });
    expect(report.ok).toBe(true);
  }, 180_000);
});

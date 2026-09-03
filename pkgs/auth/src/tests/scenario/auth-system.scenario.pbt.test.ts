import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import { check } from '@pkgs/dst/pbt';

import {
  AUTH_SESSION_TTL_MS,
  IDP_PROVIDER_DEV,
  IDP_PROVIDER_GOOGLE,
} from '../../shared/auth-constants';
import {
  AUTH_ACTIONS,
  AUTH_PROPERTIES,
  advanceClock,
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

function fabricDraws(fabric: AuthFabric): readonly unknown[] {
  return [fabric, 2, true, true];
}

function startAuth(
  fabric: AuthFabric,
  seed: number,
  draws?: readonly unknown[]
) {
  return start(auth, {
    seed,
    draws: draws ?? fabricDraws(fabric),
    properties: AUTH_PROPERTIES,
  });
}

async function signIn(
  run: Awaited<ReturnType<typeof startAuth>>,
  clientId: string,
  provider: typeof IDP_PROVIDER_DEV | typeof IDP_PROVIDER_GOOGLE,
  subject: string
): Promise<void> {
  await run.apply(oauthStart, {
    clientId,
    provider,
    callbackUrl: 'http://callback.test/sso',
  });
  await run.apply(oauthApprove, { clientId, provider, subject });
  await run.apply(sessionExchange, clientId);
}

describe('auth system / PBT', () => {
  for (const fabric of AUTH_FABRICS) {
    test(`dev oauth same subject → same user (${fabric})`, async () => {
      await using run = await startAuth(fabric, 42);
      await signIn(run, 'c0', IDP_PROVIDER_DEV, 'alice');
      await signIn(run, 'c1', IDP_PROVIDER_DEV, 'alice');

      const bearers = await run.observe(clientBearers);
      const b0 = bearers['c0'];
      const b1 = bearers['c1'];
      expect(b0).not.toBeNull();
      expect(b1).not.toBeNull();
      expect(b0).not.toBe(b1);
      const u0 = await run.observe(sessionUser(b0 as string));
      const u1 = await run.observe(sessionUser(b1 as string));
      expect(u0?.externalUserId).toBe(u1?.externalUserId as string);
    }, 60_000);

    test(`session expires as the clock advances (${fabric})`, async () => {
      await using run = await startAuth(fabric, 7);
      await signIn(run, 'c0', IDP_PROVIDER_DEV, 'alice');

      const bearer = (await run.observe(clientBearers))['c0'] as string;
      expect(await run.observe(sessionUser(bearer))).not.toBeNull();
      await run.apply(advanceClock, AUTH_SESSION_TTL_MS + 1);
      expect(await run.observe(sessionUser(bearer))).toBeNull();
    }, 60_000);

    test(`sign-out invalidates only that session (${fabric})`, async () => {
      await using run = await startAuth(fabric, 9);
      await signIn(run, 'c0', IDP_PROVIDER_DEV, 'alice');
      await signIn(run, 'c1', IDP_PROVIDER_DEV, 'alice');
      const b1 = (await run.observe(clientBearers))['c1'] as string;
      await run.apply(signOut, 'c0');

      expect((await run.observe(clientBearers))['c0']).toBeNull();
      expect(await run.observe(sessionUser(b1))).not.toBeNull();
    }, 60_000);

    test(`google oauth happy path (${fabric})`, async () => {
      await using run = await startAuth(fabric, 11);
      await signIn(run, 'c0', IDP_PROVIDER_GOOGLE, 'g-alice');

      const bearer = (await run.observe(clientBearers))['c0'];
      expect(bearer).not.toBeNull();
      expect(await run.observe(sessionUser(bearer as string))).not.toBeNull();
    }, 60_000);

    test(`dev provider knob off returns 404 on launch (${fabric})`, async () => {
      await using run = await startAuth(fabric, 13, [fabric, 2, false, true]);
      await run.apply(fetchAuth, {
        path: LAUNCH_DEV_URL,
        init: { method: 'GET', redirect: 'manual' },
      });
      expect(await run.observe(lastStatus)).toBe(404);
    }, 60_000);

    test(`dual-open runs share a fingerprint (${fabric})`, async () => {
      async function once(seed: number): Promise<string> {
        await using run = await startAuth(fabric, seed);
        await signIn(run, 'c0', IDP_PROVIDER_DEV, 'alice');
        return await run.observe(storeFingerprint);
      }
      for (const seed of [1, 2, 3, 4]) {
        expect(await once(seed)).toBe(await once(seed));
      }
    }, 120_000);

    test(`schema migrate is idempotent (${fabric})`, async () => {
      await using run = await startAuth(fabric, 1);
      const before = await run.observe(storeFingerprint);
      await run.apply(migrateSchema);
      expect(await run.observe(storeFingerprint)).toBe(before);
    }, 60_000);
  }

  test('check explores knobs + library + domain actions', async () => {
    const report = await check(auth, {
      properties: AUTH_PROPERTIES,
      actions: AUTH_ACTIONS,
      episodes: 4,
      steps: 10,
      seed: 1,
      stopOnViolation: true,
    });
    expect(report.ok).toBe(true);
  }, 180_000);
});

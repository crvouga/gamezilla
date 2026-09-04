import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import { check } from '@pkgs/dst/pbt';

import {
  AUTH_SESSION_TTL_MS,
  IDP_PROVIDER_DEV,
  IDP_PROVIDER_GOOGLE,
} from '../../shared/auth-constants';
import { worldFingerprint } from './invariants';
import { migrateAuthSchema } from './nodes';
import {
  AUTH_ACTIONS,
  AUTH_PROPERTIES,
  advanceClock,
  auth,
  oauthApprove,
  oauthStart,
  sessionExchange,
  signOut,
} from './system';
import { AUTH_FABRICS, type AuthFabric, requireActor } from './types';

function fabricDraws(fabric: AuthFabric): readonly unknown[] {
  return [fabric, 2, true, true];
}

describe('auth system / PBT', () => {
  for (const fabric of AUTH_FABRICS) {
    test(`dev oauth same subject → same user (${fabric})`, async () => {
      await using s = await start(auth, {
        seed: 42,
        draws: fabricDraws(fabric),
        properties: AUTH_PROPERTIES,
      });
      await s.apply(oauthStart, {
        clientId: 'c0',
        provider: IDP_PROVIDER_DEV,
        callbackUrl: 'http://callback.test/sso',
      });
      await s.apply(oauthApprove, {
        clientId: 'c0',
        provider: IDP_PROVIDER_DEV,
        subject: 'alice',
      });
      await s.apply(sessionExchange, 'c0');
      await s.apply(oauthStart, {
        clientId: 'c1',
        provider: IDP_PROVIDER_DEV,
        callbackUrl: 'http://callback.test/sso',
      });
      await s.apply(oauthApprove, {
        clientId: 'c1',
        provider: IDP_PROVIDER_DEV,
        subject: 'alice',
      });
      await s.apply(sessionExchange, 'c1');

      const surface = run._internal.surface;
      const c0 = requireActor(surface.clients, 'c0');
      const c1 = requireActor(surface.clients, 'c1');
      expect(c0.bearer).not.toBeNull();
      expect(c1.bearer).not.toBeNull();
      expect(c0.bearer).not.toBe(c1.bearer);
      const u0 = await surface.store.server.verifySessionToken(c0.bearer!);
      const u1 = await surface.store.server.verifySessionToken(c1.bearer!);
      expect(u0?.externalUserId).toBe(u1?.externalUserId);
    }, 60_000);

    test(`session expires as the clock advances (${fabric})`, async () => {
      await using s = await start(auth, {
        seed: 7,
        draws: fabricDraws(fabric),
        properties: AUTH_PROPERTIES,
      });
      await s.apply(oauthStart, {
        clientId: 'c0',
        provider: IDP_PROVIDER_DEV,
        callbackUrl: 'http://callback.test/sso',
      });
      await s.apply(oauthApprove, {
        clientId: 'c0',
        provider: IDP_PROVIDER_DEV,
        subject: 'alice',
      });
      await s.apply(sessionExchange, 'c0');

      const surface = run._internal.surface;
      const bearer = requireActor(surface.clients, 'c0').bearer!;
      expect(
        await surface.store.server.verifySessionToken(bearer)
      ).not.toBeNull();
      await s.apply(advanceClock, AUTH_SESSION_TTL_MS + 1);
      expect(await surface.store.server.verifySessionToken(bearer)).toBeNull();
    }, 60_000);

    test(`sign-out invalidates only that session (${fabric})`, async () => {
      await using s = await start(auth, {
        seed: 9,
        draws: fabricDraws(fabric),
        properties: AUTH_PROPERTIES,
      });
      await s.apply(oauthStart, {
        clientId: 'c0',
        provider: IDP_PROVIDER_DEV,
        callbackUrl: 'http://callback.test/sso',
      });
      await s.apply(oauthApprove, {
        clientId: 'c0',
        provider: IDP_PROVIDER_DEV,
        subject: 'alice',
      });
      await s.apply(sessionExchange, 'c0');
      await s.apply(oauthStart, {
        clientId: 'c1',
        provider: IDP_PROVIDER_DEV,
        callbackUrl: 'http://callback.test/sso',
      });
      await s.apply(oauthApprove, {
        clientId: 'c1',
        provider: IDP_PROVIDER_DEV,
        subject: 'alice',
      });
      await s.apply(sessionExchange, 'c1');
      await s.apply(signOut, 'c0');

      const surface = run._internal.surface;
      expect(requireActor(surface.clients, 'c0').bearer).toBeNull();
      const b1 = requireActor(surface.clients, 'c1').bearer!;
      expect(await surface.store.server.verifySessionToken(b1)).not.toBeNull();
    }, 60_000);

    test(`google oauth happy path (${fabric})`, async () => {
      await using s = await start(auth, {
        seed: 11,
        draws: fabricDraws(fabric),
        properties: AUTH_PROPERTIES,
      });
      await s.apply(oauthStart, {
        clientId: 'c0',
        provider: IDP_PROVIDER_GOOGLE,
        callbackUrl: 'http://callback.test/sso',
      });
      await s.apply(oauthApprove, {
        clientId: 'c0',
        provider: IDP_PROVIDER_GOOGLE,
        subject: 'g-alice',
      });
      await s.apply(sessionExchange, 'c0');

      const surface = run._internal.surface;
      const bearer = requireActor(surface.clients, 'c0').bearer;
      expect(bearer).not.toBeNull();
      expect(
        await surface.store.server.verifySessionToken(bearer!)
      ).not.toBeNull();
    }, 60_000);

    test(`dev provider knob off returns 404 on launch (${fabric})`, async () => {
      await using s = await start(auth, {
        seed: 13,
        draws: [fabric, 2, false, true],
        properties: AUTH_PROPERTIES,
      });
      const res = await run._internal.surface.store.fetch(
        '/auth/oauth/launch?provider=dev&callbackUrl=http%3A%2F%2Fcallback.test%2Fsso',
        { method: 'GET', redirect: 'manual' }
      );
      expect(res.status).toBe(404);
    }, 60_000);

    test(`dual-open runs share a fingerprint (${fabric})`, async () => {
      async function once(seed: number): Promise<string> {
        await using s = await start(auth, {
          seed,
          draws: fabricDraws(fabric),
          properties: AUTH_PROPERTIES,
        });
        await s.apply(oauthStart, {
          clientId: 'c0',
          provider: IDP_PROVIDER_DEV,
          callbackUrl: 'http://callback.test/sso',
        });
        await s.apply(oauthApprove, {
          clientId: 'c0',
          provider: IDP_PROVIDER_DEV,
          subject: 'alice',
        });
        await s.apply(sessionExchange, 'c0');
        return worldFingerprint(run._internal.surface);
      }
      for (const seed of [1, 2, 3, 4]) {
        expect(await once(seed)).toBe(await once(seed));
      }
    }, 120_000);

    test(`schema migrate is idempotent (${fabric})`, async () => {
      await using s = await start(auth, {
        seed: 1,
        draws: fabricDraws(fabric),
        properties: AUTH_PROPERTIES,
      });
      const surface = run._internal.surface;
      const before = await worldFingerprint(surface);
      await migrateAuthSchema(surface.store.fabric, surface.store.sql);
      expect(await worldFingerprint(surface)).toBe(before);
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

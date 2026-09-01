import { describe, expect, test } from 'bun:test';
import type { World } from '@pkgs/determinism';
import { openWorld } from '@pkgs/determinism';
import {
  assertSample,
  assertSampleProperty,
  replay,
} from '@pkgs/determinism/pbt';
import { fc } from '@pkgs/pbt';

import { AUTH_SESSION_TTL_MS } from '../../shared/auth-constants';
import { type AuthAction, arbAuthAction } from './actions';
import { worldFingerprint } from './invariants';
import { migrateAuthSchema } from './nodes';
import { AUTH_SYSTEM } from './system';
import {
  AUTH_FABRICS,
  type AuthFabric,
  type AuthSystem,
  requireActor,
  requireStore,
} from './types';

type AuthWorld = World<AuthSystem>;

const CLIENT_IDS = ['c0', 'c1'] as const;

function knobsFor(fabric: AuthFabric): Record<string, string | number> {
  return { fabric, clientCount: CLIENT_IDS.length };
}

async function withReplay(
  fabric: AuthFabric,
  seed: number,
  actions: readonly AuthAction[],
  check: (world: AuthWorld) => Promise<void>
): Promise<void> {
  const { world } = await replay(AUTH_SYSTEM, {
    seed,
    knobs: knobsFor(fabric),
    actions,
  });
  try {
    await check(world);
  } finally {
    await world.dispose();
  }
}

describe('auth system / PBT', () => {
  for (const fabric of AUTH_FABRICS) {
    test(`dev complete same subject → same user (${fabric})`, async () => {
      await withReplay(
        fabric,
        42,
        [
          { kind: 'devComplete', clientId: 'c0', subject: 'alice' },
          { kind: 'devComplete', clientId: 'c1', subject: 'alice' },
        ],
        async (world) => {
          const store = requireStore(world.system);
          const c0 = requireActor(world.system, 'c0');
          const c1 = requireActor(world.system, 'c1');
          expect(c0.bearer).not.toBeNull();
          expect(c1.bearer).not.toBeNull();
          expect(c0.bearer).not.toBe(c1.bearer);
          const u0 = await store.server.verifySessionToken(c0.bearer!);
          const u1 = await store.server.verifySessionToken(c1.bearer!);
          expect(u0?.externalUserId).toBe(u1?.externalUserId);
        }
      );
    }, 60_000);

    test(`session expires as the clock advances (${fabric})`, async () => {
      await withReplay(
        fabric,
        7,
        [{ kind: 'devComplete', clientId: 'c0', subject: 'alice' }],
        async (world) => {
          const store = requireStore(world.system);
          const bearer = requireActor(world.system, 'c0').bearer!;
          expect(await store.server.verifySessionToken(bearer)).not.toBeNull();
          await world.runFor(AUTH_SESSION_TTL_MS + 1);
          expect(await store.server.verifySessionToken(bearer)).toBeNull();
        }
      );
    }, 60_000);

    test(`sign-out invalidates only that session (${fabric})`, async () => {
      await withReplay(
        fabric,
        9,
        [
          { kind: 'devComplete', clientId: 'c0', subject: 'alice' },
          { kind: 'devComplete', clientId: 'c1', subject: 'alice' },
          { kind: 'signOut', clientId: 'c0' },
        ],
        async (world) => {
          const store = requireStore(world.system);
          expect(requireActor(world.system, 'c0').bearer).toBeNull();
          const b1 = requireActor(world.system, 'c1').bearer!;
          expect(await store.server.verifySessionToken(b1)).not.toBeNull();
        }
      );
    }, 60_000);

    test(`google oauth happy path (${fabric})`, async () => {
      await withReplay(
        fabric,
        11,
        [
          {
            kind: 'googleStart',
            clientId: 'c0',
            callbackUrl: 'http://callback.test/sso',
          },
          { kind: 'googleApprove', clientId: 'c0', subject: 'g-alice' },
          { kind: 'sessionExchange', clientId: 'c0' },
        ],
        async (world) => {
          const store = requireStore(world.system);
          const bearer = requireActor(world.system, 'c0').bearer;
          expect(bearer).not.toBeNull();
          expect(await store.server.verifySessionToken(bearer!)).not.toBeNull();
        }
      );
    }, 60_000);

    test(`dev provider knob off returns 404 (${fabric})`, async () => {
      await using world = await openWorld(AUTH_SYSTEM, {
        seed: 13,
        knobs: { ...knobsFor(fabric), devProvider: false },
      });
      const res = await requireStore(world.system).fetch(
        '/auth/oauth/dev/complete',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ subject: 'alice' }),
        }
      );
      expect(res.status).toBe(404);
    }, 60_000);

    test(`dual-open runs share a fingerprint (${fabric})`, async () => {
      await assertSampleProperty(
        `auth dual-open ${fabric}`,
        fc.asyncProperty(
          fc.integer({ min: 1, max: 500 }),
          fc.array(arbAuthAction(CLIENT_IDS), {
            minLength: 1,
            maxLength: 12,
          }),
          async (seed, actions) => {
            const knobs = knobsFor(fabric);
            const a = await replay(AUTH_SYSTEM, { seed, knobs, actions });
            const b = await replay(AUTH_SYSTEM, { seed, knobs, actions });
            try {
              expect(a.world.system.fingerprint).not.toBeNull();
              expect(a.world.system.fingerprint).toBe(
                b.world.system.fingerprint
              );
            } finally {
              await a.world.dispose();
              await b.world.dispose();
            }
          }
        )
      );
    }, 120_000);

    test(`schema migrate is idempotent (${fabric})`, async () => {
      await using world = await openWorld(AUTH_SYSTEM, {
        seed: 1,
        knobs: knobsFor(fabric),
      });
      const store = requireStore(world.system);
      const before = await worldFingerprint(world);
      await migrateAuthSchema(store.fabric, store.sql);
      expect(await worldFingerprint(world)).toBe(before);
    }, 60_000);
  }

  test('assertSample explores knobs + library + domain actions', async () => {
    await assertSample(AUTH_SYSTEM, { maxCommands: 10 });
  }, 180_000);
});

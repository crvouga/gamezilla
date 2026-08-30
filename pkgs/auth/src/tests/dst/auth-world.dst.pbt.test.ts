import { describe, expect, test } from 'bun:test';
import { assertDstProperty, assertProperty, fc } from '@pkgs/pbt';

import { AUTH_SESSION_TTL_MS } from '../../shared/auth-constants';
import { runAuthCommands } from './apply-auth-cmd';
import {
  type AuthCmd,
  type AuthFabric,
  appFetch,
  openAuthWorld,
  worldFingerprint,
} from './world';

const FABRICS: AuthFabric[] = ['sqlite-mem', 'postgres-mem'];

function arbClientId(): fc.Arbitrary<string> {
  return fc.constantFrom('c0', 'c1');
}

function arbSubject(): fc.Arbitrary<string> {
  return fc.constantFrom('alice', 'bob', 'carol');
}

function arbCmd(): fc.Arbitrary<AuthCmd> {
  return fc.oneof(
    fc.record({
      kind: fc.constant('devComplete' as const),
      clientId: arbClientId(),
      subject: arbSubject(),
    }),
    fc.record({
      kind: fc.constant('googleStart' as const),
      clientId: arbClientId(),
      callbackUrl: fc.constantFrom(
        'http://callback.test/sso',
        'gamezilla://sso-callback',
        'https://evil.example/sso'
      ),
    }),
    fc.record({
      kind: fc.constant('googleApprove' as const),
      clientId: arbClientId(),
      subject: arbSubject(),
    }),
    fc.record({
      kind: fc.constant('sessionExchange' as const),
      clientId: arbClientId(),
    }),
    fc.record({
      kind: fc.constant('signOut' as const),
      clientId: arbClientId(),
    }),
    fc.record({
      kind: fc.constant('advanceClock' as const),
      ms: fc.constantFrom(1_000, AUTH_SESSION_TTL_MS + 1),
    }),
    fc.record({
      kind: fc.constant('stealBearer' as const),
      from: arbClientId(),
      to: arbClientId(),
    }),
    fc.record({
      kind: fc.constant('setGoogleFault' as const),
      fault: fc.boolean(),
    })
  );
}

describe('auth DST / PBT', () => {
  for (const fabric of FABRICS) {
    test(`dev complete same subject → same user (${fabric})`, async () => {
      const world = await openAuthWorld({ seed: 42, fabric });
      await runAuthCommands(world, [
        { kind: 'devComplete', clientId: 'c0', subject: 'alice' },
        { kind: 'devComplete', clientId: 'c1', subject: 'alice' },
      ]);
      const c0 = world.clients.get('c0')!;
      const c1 = world.clients.get('c1')!;
      expect(c0.bearer).not.toBeNull();
      expect(c1.bearer).not.toBeNull();
      expect(c0.bearer).not.toBe(c1.bearer);
      const u0 = await world.server.verifySessionToken(c0.bearer!);
      const u1 = await world.server.verifySessionToken(c1.bearer!);
      expect(u0?.externalUserId).toBe(u1?.externalUserId);
    }, 60_000);

    test(`session expires via clock.advance (${fabric})`, async () => {
      const world = await openAuthWorld({ seed: 7, fabric });
      await runAuthCommands(world, [
        { kind: 'devComplete', clientId: 'c0', subject: 'alice' },
      ]);
      const bearer = world.clients.get('c0')!.bearer!;
      expect(await world.server.verifySessionToken(bearer)).not.toBeNull();
      world.clock.advance(AUTH_SESSION_TTL_MS + 1);
      expect(await world.server.verifySessionToken(bearer)).toBeNull();
    }, 60_000);

    test(`sign-out invalidates only that session (${fabric})`, async () => {
      const world = await openAuthWorld({ seed: 9, fabric });
      await runAuthCommands(world, [
        { kind: 'devComplete', clientId: 'c0', subject: 'alice' },
        { kind: 'devComplete', clientId: 'c1', subject: 'alice' },
        { kind: 'signOut', clientId: 'c0' },
      ]);
      expect(world.clients.get('c0')!.bearer).toBeNull();
      const b1 = world.clients.get('c1')!.bearer!;
      expect(await world.server.verifySessionToken(b1)).not.toBeNull();
    }, 60_000);

    test(`google oauth happy path (${fabric})`, async () => {
      const world = await openAuthWorld({ seed: 11, fabric });
      await runAuthCommands(world, [
        {
          kind: 'googleStart',
          clientId: 'c0',
          callbackUrl: 'http://callback.test/sso',
        },
        { kind: 'googleApprove', clientId: 'c0', subject: 'g-alice' },
        { kind: 'sessionExchange', clientId: 'c0' },
      ]);
      const bearer = world.clients.get('c0')!.bearer;
      expect(bearer).not.toBeNull();
      expect(await world.server.verifySessionToken(bearer!)).not.toBeNull();
    }, 60_000);

    test(`dev disabled returns 404 (${fabric})`, async () => {
      const world = await openAuthWorld({
        seed: 13,
        fabric,
        enableDev: false,
      });
      const res = await appFetch(world, '/auth/oauth/dev/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subject: 'alice' }),
      });
      expect(res.status).toBe(404);
    }, 60_000);

    test(`seeded dual-run fingerprint (${fabric})`, async () => {
      await assertDstProperty(
        `auth dual-run ${fabric}`,
        fc.asyncProperty(
          fc.integer({ min: 1, max: 500 }),
          fc.array(arbCmd(), { minLength: 1, maxLength: 12 }),
          async (seed, cmds) => {
            const a = await openAuthWorld({ seed, fabric });
            const b = await openAuthWorld({ seed, fabric });
            await runAuthCommands(a, cmds);
            await runAuthCommands(b, cmds);
            expect(await worldFingerprint(a)).toBe(await worldFingerprint(b));
          }
        )
      );
    }, 120_000);
  }

  test('schema migrate is idempotent', async () => {
    await assertProperty(
      'migrate twice',
      fc.asyncProperty(fc.constantFrom(...FABRICS), async (fabric) => {
        const world = await openAuthWorld({ seed: 1, fabric });
        const before = await worldFingerprint(world);
        const { AuthSqliteDatabaseMigration, AuthPostgresDatabaseMigration } =
          await import('../../server/auth-database-migration');
        const { createNoopLogger } = await import('@pkgs/logger');
        const { createPostgresDbScope } = await import(
          '@pkgs/sql-client/postgres/schema'
        );
        const logger = createNoopLogger();
        if (fabric === 'sqlite-mem') {
          await new AuthSqliteDatabaseMigration().migrate({
            sqlClient: world.sql,
            logger,
          });
        } else {
          await new AuthPostgresDatabaseMigration({
            dbScope: createPostgresDbScope('public'),
            skipAdvisoryLock: true,
          }).migrate({ sqlClient: world.sql, logger });
        }
        expect(await worldFingerprint(world)).toBe(before);
      })
    );
  });
});

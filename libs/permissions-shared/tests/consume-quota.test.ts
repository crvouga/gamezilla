import { describe, expect, test } from 'bun:test';
import { CLIENT_CONFIG_TABLES } from '@libs/app-config-shared/tables';
import { ACTION } from '@libs/permissions-shared/permission-catalog';
import { PERMISSIONS_TABLES } from '@libs/permissions-shared/tables';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions-shared/permission-policy';
import { PERMISSIONS_MUTATIONS } from '@libs/permissions-shared/mutations';
import { authorizeAppMutation } from '@libs/permissions-shared/authorize-app-mutation';
import { defineTable } from '@pkgs/db-schema-shared/define-table';
import { registerTables } from '@pkgs/db-schema-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import sql from '@pkgs/sql-shared/sql';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-shared/impl-mockingbird-sqlite';
import type { MutationEnv } from '@pkgs/sync-engine-shared/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared/mutations-types';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';
import fc from 'fast-check';

/** Shape of billing's synced table (the resolver reads it; billing owns it). */
const billingSubscriptionsFixture = defineTable({
  domain: 'billing',
  name: 'billing_subscriptions',
  columns: {
    account_id: 'text',
    status: 'text',
    current_period_end: 'timestamp',
    cancel_at_period_end: 'boolean',
  },
});

const [consumeQuota] = PERMISSIONS_MUTATIONS;
const DAY0 = Date.parse('2026-09-19T10:00:00.000Z');
const HOUR = 3_600_000;

async function openDb(): Promise<SqlClient> {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await reconcileSqliteSchema(
    db,
    registerTables([
      ...PERMISSIONS_TABLES,
      ...CLIENT_CONFIG_TABLES,
      billingSubscriptionsFixture,
    ]),
    { ownership: 'declared-only' }
  );
  return db;
}

let idSeq = 0;
function env(args: {
  readonly actorId: string;
  readonly clientMs: number;
  readonly serverMs?: number;
  readonly signedIn?: boolean;
}): MutationEnv {
  return {
    actorId: args.actorId,
    deviceId: 'device',
    accountId: args.signedIn === true ? args.actorId : null,
    isAnon: args.signedIn !== true,
    now: () => new Date(args.clientMs),
    createId: () => `managed-${++idSeq}`,
    ...(args.serverMs === undefined
      ? {}
      : { serverNow: () => new Date(args.serverMs ?? 0) }),
  };
}

async function consume(
  db: SqlClient,
  mutationEnv: MutationEnv,
  key: string
): Promise<string> {
  const { tx } = wrapMutationDb(db, mutationEnv);
  try {
    await consumeQuota.run(
      { tx, env: mutationEnv },
      {
        id: `row-${++idSeq}`,
        quota: ACTION.puzzleRatedSolve,
        idempotencyKey: key,
        amount: 1,
      }
    );
    return 'allowed';
  } catch (error) {
    if (error instanceof MutationError) return error.code;
    throw error;
  }
}

async function ledgerCount(db: SqlClient, owner: string): Promise<number> {
  const rows = await db.query<{ n: number }>(sql<{ n: number }>`
    SELECT COUNT(*) AS n FROM permissions_quota_ledger WHERE owner_id = ${owner}
  `);
  return Number(rows[0]?.n ?? 0);
}

const LIMIT =
  DEFAULT_PERMISSION_POLICY.roles['plan:guest']?.quotas?.[
    ACTION.puzzleRatedSolve
  ]?.limit ?? 0;

describe('consumeQuota', () => {
  test('anonymous: limit units per UTC day, then quota_exhausted', async () => {
    const db = await openDb();
    const at = env({ actorId: 'anon', clientMs: DAY0, serverMs: DAY0 });
    for (let i = 0; i < LIMIT; i += 1) {
      expect(await consume(db, at, `k${i}`)).toBe('allowed');
    }
    expect(await consume(db, at, 'one-more')).toBe('quota_exhausted');
    expect(await ledgerCount(db, 'anon')).toBe(LIMIT);
    const tomorrow = env({
      actorId: 'anon',
      clientMs: DAY0 + 24 * HOUR,
      serverMs: DAY0 + 24 * HOUR,
    });
    expect(await consume(db, tomorrow, 'one-more')).toBe('allowed');
  });

  test('a verified account is unlimited (no code branch: roles from facts)', async () => {
    const db = await openDb();
    const at = env({
      actorId: 'acct',
      clientMs: DAY0,
      serverMs: DAY0,
      signedIn: true,
    });
    for (let i = 0; i < LIMIT + 5; i += 1) {
      expect(await consume(db, at, `k${i}`)).toBe('allowed');
    }
  });

  test('server time decides the window: a skewed-forward client cannot reset it', async () => {
    const db = await openDb();
    const honest = env({ actorId: 'anon', clientMs: DAY0, serverMs: DAY0 });
    for (let i = 0; i < LIMIT; i += 1) await consume(db, honest, `k${i}`);
    const skewed = env({
      actorId: 'anon',
      clientMs: DAY0 + 48 * HOUR,
      serverMs: DAY0 + HOUR,
    });
    expect(await consume(db, skewed, 'skewed')).toBe('quota_exhausted');
  });

  test('property: retries and duplicated replays never double-charge', async () => {
    await assertProperty(
      'property: retries and duplicated replays never double-charge',
      fc.asyncProperty(
        fc.array(fc.integer({ min: 0, max: 7 }), {
          minLength: 1,
          maxLength: 40,
        }),
        async (keys) => {
          const db = await openDb();
          const at = env({ actorId: 'anon', clientMs: DAY0, serverMs: DAY0 });
          const seen = new Set<number>();
          for (const key of keys) {
            await consume(db, at, `attempt-${key}`);
            seen.add(key);
            // Invariant at every step: rows ≤ distinct keys.
            expect(await ledgerCount(db, 'anon')).toBe(
              Math.min(seen.size, LIMIT)
            );
          }
        }
      ),
      { seed: 20_260_919, numRuns: 25 }
    );
  });

  test('two devices race for the last unit: replay serializes, exactly one wins', async () => {
    const db = await openDb();
    const at = env({ actorId: 'anon', clientMs: DAY0, serverMs: DAY0 });
    for (let i = 0; i < LIMIT - 1; i += 1) await consume(db, at, `k${i}`);
    const phone = env({ actorId: 'anon', clientMs: DAY0, serverMs: DAY0 + 1 });
    const tablet = env({ actorId: 'anon', clientMs: DAY0, serverMs: DAY0 + 2 });
    const verdicts = [
      await consume(db, phone, 'phone-attempt'),
      await consume(db, tablet, 'tablet-attempt'),
    ];
    expect(verdicts).toEqual(['allowed', 'quota_exhausted']);
    expect(await ledgerCount(db, 'anon')).toBe(LIMIT);
  });

  test('offline replay evaluates under the policy version active at its client timestamp', async () => {
    const db = await openDb();
    const publishedAt = DAY0 + 2 * HOUR;
    const policy = {
      ...DEFAULT_PERMISSION_POLICY,
      version: 'v-new',
      activeFromMs: publishedAt,
      roles: {
        ...DEFAULT_PERMISSION_POLICY.roles,
        'plan:guest': {
          ...DEFAULT_PERMISSION_POLICY.roles['plan:guest'],
          quotas: {
            [ACTION.puzzleRatedSolve]: { limit: 1, window: 'day' },
          },
        },
      },
      history: [{ ...DEFAULT_PERMISSION_POLICY, version: 'v-old' }],
    };
    await db.run(sql`
      INSERT INTO client_config (id, value, created_at, updated_at, deleted_at)
      VALUES ('permission_policy', ${JSON.stringify(policy)},
        '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', NULL)
    `);
    // Played offline before the publish, replayed after it: old version.
    const offline = env({
      actorId: 'anon',
      clientMs: DAY0,
      serverMs: publishedAt + HOUR,
    });
    expect(await consume(db, offline, 'offline-1')).toBe('allowed');
    expect(await consume(db, offline, 'offline-2')).toBe('allowed');
    const versions = await db.query<{ v: string }>(sql<{ v: string }>`
      SELECT DISTINCT policy_version AS v FROM permissions_quota_ledger
    `);
    expect(versions.map((row) => row.v)).toEqual(['v-old']);
    // A consume made after the publish is decided by the new version.
    const online = env({
      actorId: 'anon',
      clientMs: publishedAt + HOUR,
      serverMs: publishedAt + HOUR,
    });
    expect(await consume(db, online, 'online-1')).toBe('quota_exhausted');
  });

  test('synced rows in Postgres timestamp text still count toward the window', async () => {
    const db = await openDb();
    for (let i = 0; i < LIMIT; i += 1) {
      await db.run(sql`
        INSERT INTO permissions_quota_ledger (
          id, owner_id, quota, idempotency_key, amount, consumed_at,
          policy_version, created_at, updated_at, deleted_at
        ) VALUES (
          ${`synced-${i}`}, 'anon', ${ACTION.puzzleRatedSolve}, ${`synced-${i}`},
          1, '2026-09-19 09:00:00.2+00', 'v', '2026-09-19 09:00:00.2+00',
          '2026-09-19 09:00:00.2+00', NULL
        )
      `);
    }
    const at = env({ actorId: 'anon', clientMs: DAY0, serverMs: DAY0 });
    expect(await consume(db, at, 'after-sync')).toBe('quota_exhausted');
  });

  test('server replay: the guard consumes with the host clock; skewed devices cannot mint quota', async () => {
    const db = await openDb();
    const honest = env({ actorId: 'anon', clientMs: DAY0, serverMs: DAY0 });
    for (let i = 0; i < LIMIT; i += 1) await consume(db, honest, `k${i}`);
    for (const skewMs of [48 * HOUR, -30 * HOUR]) {
      const device = env({ actorId: 'anon', clientMs: DAY0 + skewMs });
      const { tx } = wrapMutationDb(db, device);
      let code = 'allowed';
      try {
        await authorizeAppMutation({
          name: 'consumeQuota',
          args: {
            id: `skew-${skewMs}`,
            quota: ACTION.puzzleRatedSolve,
            idempotencyKey: `skew-${skewMs}`,
            amount: 1,
          },
          tx,
          env: device,
          serverNow: () => new Date(DAY0 + HOUR),
        });
      } catch (error) {
        if (!(error instanceof MutationError)) throw error;
        code = error.code;
      }
      expect(code).toBe('quota_exhausted');
    }
    expect(await ledgerCount(db, 'anon')).toBe(LIMIT);
  });

  test('server replay: after the guard consumed a key the body is a no-op', async () => {
    const db = await openDb();
    const device = env({ actorId: 'anon', clientMs: DAY0 - 5 * HOUR });
    const { tx } = wrapMutationDb(db, device);
    const args = {
      id: 'row-guarded',
      quota: ACTION.puzzleRatedSolve,
      idempotencyKey: 'guarded',
      amount: 1,
    };
    await authorizeAppMutation({
      name: 'consumeQuota',
      args,
      tx,
      env: device,
      serverNow: () => new Date(DAY0),
    });
    await consumeQuota.run({ tx, env: device }, args);
    const rows = await db.query<{ consumed_at: string }>(
      sql<{
        consumed_at: string;
      }>`SELECT consumed_at FROM permissions_quota_ledger`
    );
    expect(rows.map((row) => row.consumed_at)).toEqual([
      new Date(DAY0).toISOString(),
    ]);
  });

  test('server replay: an undeclared mutation is rejected', async () => {
    const db = await openDb();
    const device = env({ actorId: 'anon', clientMs: DAY0 });
    const { tx } = wrapMutationDb(db, device);
    await expect(
      authorizeAppMutation({
        name: 'notDeclaredAnywhere',
        args: {},
        tx,
        env: device,
        serverNow: () => new Date(DAY0),
      })
    ).rejects.toMatchObject({ code: 'undeclared_action' });
  });
});

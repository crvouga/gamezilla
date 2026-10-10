import { expect, test } from 'bun:test';
import { sessionTelemetryPopulation } from '@libs/auth-shared/session-telemetry-population';
import { syntheticPopulationUsers } from '@libs/synthetic-population-shared/tables';
import { syntheticPopulationAccountIds } from '@libs/synthetic-population-shared/telemetry-population';
import type { VerifiedSession } from '@pkgs/auth-root-shared/verified-session';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared/sql';

const session: VerifiedSession = {
  externalUserId: 'external-bot',
  accountId: null,
  email: 'bot@example.test',
  expiresAt: null,
  authenticatedAt: null,
  synthetic: false,
};

// regression: otel-synthetic-population-provenance
test('ordinary IdP sign-in cannot classify a provisioned population bot as genuine activity', async () => {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileSqliteSchema(db, registerTables([syntheticPopulationUsers]));
    await db.run(sql`INSERT INTO population_users (id, email, account_id, deleted_at)
      VALUES (${'population-bot'}, ${'bot@example.test'}, ${'population-account'}, ${'2026-01-01T00:00:00.000Z'})`);
    expect(await sessionTelemetryPopulation(db, session)).toBe(true);
    expect(await syntheticPopulationAccountIds(db)).toEqual([
      'population-account',
    ]);
    expect(
      await sessionTelemetryPopulation(db, {
        ...session,
        email: 'customer@example.test',
      })
    ).toBe(false);
    const { synthetic: _synthetic, ...unknown } = session;
    expect(
      await sessionTelemetryPopulation(db, { ...unknown, email: null })
    ).toBeUndefined();
    expect(
      await sessionTelemetryPopulation(db, {
        ...session,
        email: null,
        synthetic: true,
      })
    ).toBe(true);
  } finally {
    await db.disconnect();
  }
});

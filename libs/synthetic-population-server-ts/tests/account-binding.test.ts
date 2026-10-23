import { expect, test } from 'bun:test';
import { AUTH_TABLES } from '@libs/auth-shared-ts/tables';
import { ensureProfileMutation } from '@libs/profile-shared-ts/ensure-profile-mutation';
import { PROFILE_TABLES } from '@libs/profile-shared-ts/tables';
import { bindSyntheticPopulationAccount } from '@libs/synthetic-population-server-ts/account-binding';
import { SYNTHETIC_POPULATION_TABLES } from '@libs/synthetic-population-shared-ts/tables';
import type { AuthServerPort } from '@pkgs/auth-root-shared-ts/auth-server-port';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { syntheticPopulationFixture } from './synthetic-population-fixture';

async function bindingFixture() {
  const f = await syntheticPopulationFixture();
  await reconcileSqliteSchema(
    f.db,
    registerTables([
      ...AUTH_TABLES,
      ...PROFILE_TABLES,
      ...SYNTHETIC_POPULATION_TABLES,
    ])
  );
  const assignment = (await f.controller.claim(f.workers[0]!))!;
  const accountId = f.createId();
  const externalId = f.createId();
  const now = new Date(f.clock.now()).toISOString();
  await f.db.run(sql`INSERT INTO auth_users (id, created_at, is_anon)
    VALUES (${accountId}, ${now}, ${false})`);
  await f.db.run(sql`INSERT INTO auth_external_accounts (id, created_at, user_id, provider, external_id)
    VALUES (${f.createId()}, ${now}, ${accountId}, ${'binding-port'}, ${externalId})`);
  await f.db.run(sql`INSERT INTO profile (id, created_at, username, username_norm)
    VALUES (${accountId}, ${now}, ${'cedar'}, ${'cedar'})`);
  let checks = 0;
  let email = assignment.email;
  let expireOnResolution = false;
  const authServer: AuthServerPort = {
    provider: 'binding-port',
    verifySessionToken: async (token) => {
      checks += 1;
      if (expireOnResolution && checks === 2)
        f.clock.advance(assignment.config.leaseMs);
      return token === 'verified-session'
        ? {
            externalUserId: externalId,
            accountId,
            email,
            expiresAt: null,
            authenticatedAt: null,
          }
        : null;
    },
    getUser: async () => null,
    deleteUser: async () => undefined,
  };
  const notified: string[] = [];
  const deps = {
    db: f.db,
    ports: f.ports,
    authServer,
    notifyProfile: async (id: string) => {
      notified.push(id);
    },
  };
  return {
    ...f,
    assignment,
    accountId,
    deps,
    notified,
    mismatch: () => {
      email = 'ordinary-person@example.test';
    },
    expireWhileResolving: () => {
      expireOnResolution = true;
    },
    profile: async () =>
      (
        await f.db.query(sql<{ account_kind: string | null; username: string }>`
      SELECT account_kind, username FROM profile WHERE id = ${accountId}`)
      )[0]!,
  };
}

test('only verified, exclusively owned accounts receive a public Synthetic User classification', async () => {
  const f = await bindingFixture();
  try {
    expect(
      await bindSyntheticPopulationAccount(
        f.deps,
        f.assignment.lease,
        'unknown'
      )
    ).toBe(false);
    expect((await f.profile()).account_kind).toBeNull();
    expect(
      await bindSyntheticPopulationAccount(
        f.deps,
        f.assignment.lease,
        'verified-session'
      )
    ).toBe(true);
    expect(await f.profile()).toEqual({
      account_kind: 'synthetic',
      username: 'cedar',
    });
    expect(f.notified).toEqual([f.accountId]);
    expect((await f.repo.user(f.assignment.lease.userId))?.account_id).toBe(
      f.accountId
    );
    expect(
      await ensureProfileMutation.args['~standard'].validate({
        account_kind: 'synthetic',
      })
    ).toEqual({ value: {} });
  } finally {
    await f.db.disconnect();
  }
});

test.each(['address', 'expiry', 'expiry during resolution'] as const)(
  '%s mismatch cannot classify an ordinary account or publish its profile',
  async (boundary) => {
    const f = await bindingFixture();
    try {
      if (boundary === 'address') f.mismatch();
      if (boundary === 'expiry') f.clock.advance(f.assignment.config.leaseMs);
      if (boundary === 'expiry during resolution') f.expireWhileResolving();
      expect(
        await bindSyntheticPopulationAccount(
          f.deps,
          f.assignment.lease,
          'verified-session'
        )
      ).toBe(false);
      expect((await f.profile()).account_kind).toBeNull();
      expect(f.notified).toEqual([]);
      expect(
        (await f.repo.user(f.assignment.lease.userId))?.account_id
      ).toBeNull();
    } finally {
      await f.db.disconnect();
    }
  }
);

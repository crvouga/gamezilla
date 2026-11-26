import { expect, test } from 'bun:test';
import { createAdminApi } from '@apps/admin-api-ts/server';
import { AUTH_TABLES } from '@libs/auth-shared-ts/tables';
import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import { OBSERVATORY_TABLES } from '@libs/observatory-shared-ts/tables';
import { permissionPolicyForAdmins } from '@libs/permissions-shared-ts/permission-policy';
import { openConformanceDb } from '@libs/permissions-shared-ts/world';
import { SYNTHETIC_POPULATION_TABLES } from '@libs/synthetic-population-shared-ts/tables';
import type { AuthProvider } from '@pkgs/auth-root-shared-ts/auth-provider-module';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { createRecordSecretStore } from '@pkgs/secret-store-shared-ts/record-secret-store';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createHarnessAdapters } from '@pkgs/uuid-shared-ts/harness-adapters';

const ADMIN = '00000000-0000-4000-8000-000000001234';
const DEVICE = '00000000-0000-4000-8000-000000001235';
const AT = '2026-10-14T12:00:00.000Z';
const auth: AuthProvider = {
  signInMethods: [],
  server: {
    provider: 'idp',
    verifySessionToken: async (token) =>
      token === 'valid'
        ? {
            externalUserId: 'external-user',
            accountId: null,
            email: null,
            expiresAt: null,
            authenticatedAt: null,
          }
        : null,
    getUser: async () => null,
    deleteUser: async () => {},
  },
};

test('the same admin requests require a valid session and the current admin grant', async () => {
  const db = await openConformanceDb([
    ...AUTH_TABLES,
    ...BILLING_TABLES,
    ...OBSERVATORY_TABLES,
    ...SYNTHETIC_POPULATION_TABLES,
  ]);
  try {
    await db.run(
      sql`INSERT INTO auth_users (id, created_at) VALUES (${ADMIN}, ${AT})`
    );
    await db.run(sql`INSERT INTO auth_external_accounts (id, user_id, provider, external_id, metadata, created_at)
      VALUES ('external-link', ${ADMIN}, 'idp', 'external-user', '{}', ${AT})`);
    const setRoster = (ids: readonly string[]) =>
      db.run(sql`INSERT INTO client_config (id,value,created_at,updated_at)
      VALUES ('permission_policy', ${JSON.stringify(permissionPolicyForAdmins(ids))}, ${AT}, ${AT})
      ON CONFLICT(id) DO UPDATE SET value = excluded.value`);
    const ports = createHarnessAdapters({ seed: 9 });
    const api = await createAdminApi(auth, createRecordSecretStore({}), {
      ...ports,
      adminAccountIds: [],
      protection: 'standard',
      skipDatabaseUrlPolicy: true,
      objectStore: new ObjectStoreImplInMemory(),
      http: { fetch: () => Promise.reject(new Error('unexpected egress')) },
      openSqlClient: async () => db,
      random: () => 0.5,
    });
    const read = (path: string, token: string, method = 'GET') =>
      api.request(path, {
        method,
        headers: { 'x-anon-id': DEVICE, authorization: `Bearer ${token}` },
      });
    // This deployment revoked the prior roster. Its first request must already enforce it.
    await setRoster([ADMIN]);
    for (const path of [
      '/api/admin/access',
      '/api/admin/observatory/live',
      '/api/admin/synthetic-population',
      '/api/puzzle-management/source',
    ]) {
      expect((await api.request(path)).status).toBe(401);
      expect((await read(path, 'expired')).status).toBe(401);
      expect((await read(path, 'valid')).status).toBe(403);
    }
    await setRoster([ADMIN]);
    expect((await read('/api/admin/access', 'valid')).status).toBe(204);
    expect((await read('/api/admin/observatory/live', 'valid')).status).toBe(
      200
    );
    await setRoster([]);
    expect((await read('/api/admin/observatory/live', 'valid')).status).toBe(
      403
    );
    expect((await read('/api/mutations', 'valid', 'POST')).status).toBe(403);
    expect((await read('/api/query', 'valid', 'POST')).status).toBe(403);
  } finally {
    await db.disconnect();
  }
});

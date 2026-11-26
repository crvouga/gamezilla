import { expect, test } from 'bun:test';
import { CLIENT_CONFIG_TABLES } from '@libs/app-config-shared-ts/tables';
import {
  createRequestDbMiddleware,
  type RequestDbMiddlewareOptions,
} from '@libs/app-root-server-ts/request-db-middleware';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { RecordSecretStore } from '@pkgs/secret-store-shared-ts/record-secret-store';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createHarnessAdapters } from '@pkgs/uuid-shared-ts/harness-adapters';
import { Hono } from 'hono';

function requestApp(
  db: SqlClientImplBunSqlite,
  desiredClientConfig: RequestDbMiddlewareOptions['desiredClientConfig']
) {
  const ports = createHarnessAdapters({ seed: 1 });
  return new Hono()
    .use(
      '*',
      createRequestDbMiddleware(new RecordSecretStore({}), {
        ...ports,
        http: {
          fetch: async () => {
            throw new Error('unexpected HTTP');
          },
        },
        objectStore: new ObjectStoreImplInMemory(),
        authServer: {
          provider: 'idp',
          verifySessionToken: async () => null,
          getUser: async () => null,
          deleteUser: async () => {},
        },
        protection: 'standard',
        skipDatabaseUrlPolicy: true,
        openSqlClient: async () => db,
        desiredClientConfig,
      })
    )
    .get('/read', (c) => c.text('ok'))
    .get('/broken', () => {
      throw new Error('literal route failure');
    })
    .onError((error, c) => c.json({ error: error.message }, 500));
}

test('a harness request preserves a thrown database route error', async () => {
  // regression: request-finally-swallowed-route-error
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileSqliteSchema(db, registerTables(CLIENT_CONFIG_TABLES));
    const app = requestApp(db, {
      kind: 'complete',
      google: false,
      apple: false,
      billing: false,
      tts: false,
      llm: false,
      googleWebClientId: null,
      emqxWssUrl: null,
      permissionPolicy: {},
      billingGracePeriodMs: 0,
    });
    const response = await app.request('/broken');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'literal route failure' });
  } finally {
    await db.disconnect();
  }
});

// regression: fixture-api-overwrites-deployment-client-config
test('the first request to a fixture API preserves the deployment operator policy and broker', async () => {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileSqliteSchema(db, registerTables(CLIENT_CONFIG_TABLES));
    const before = [
      { id: 'emqx_wss_url', value: '"wss://stack.invalid/mqtt"' },
      { id: 'permission_policy', value: '{"version":"operator-spec"}' },
    ];
    for (const row of before) {
      await db.run(
        sql`INSERT INTO client_config (id, value, updated_at) VALUES (${row.id}, ${row.value}, ${'2026-11-24T23:02:03.000Z'})`
      );
    }
    expect((await requestApp(db, null).request('/read')).status).toBe(200);
    expect(
      await db.query(
        sql<{
          id: string;
          value: string;
        }>`SELECT id, value FROM client_config ORDER BY id`
      )
    ).toEqual(before);
  } finally {
    await db.disconnect();
  }
});

test('each application refreshes only the configuration it owns', async () => {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileSqliteSchema(db, registerTables(CLIENT_CONFIG_TABLES));
    const admin = {
      kind: 'admin',
      permissionPolicy: { version: 'staff' },
    } as const;
    const product = {
      kind: 'product',
      google: true,
      apple: false,
      billing: false,
      tts: false,
      llm: false,
      googleWebClientId: null,
      emqxWssUrl: 'wss://broker.invalid',
      billingGracePeriodMs: 0,
    } as const;
    for (const owner of [product, admin, product, admin]) {
      expect((await requestApp(db, owner).request('/read')).status).toBe(200);
    }
    expect(
      await db.query(
        sql<{
          id: string;
          value: string;
        }>`SELECT id, value FROM client_config WHERE id IN ('permission_policy', 'emqx_wss_url') ORDER BY id`
      )
    ).toEqual([
      { id: 'emqx_wss_url', value: JSON.stringify(product.emqxWssUrl) },
      {
        id: 'permission_policy',
        value: JSON.stringify(admin.permissionPolicy),
      },
    ]);
  } finally {
    await db.disconnect();
  }
});

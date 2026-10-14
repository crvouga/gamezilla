import { expect, test } from 'bun:test';
import { CLIENT_CONFIG_TABLES } from '@libs/app-config-shared/tables';
import { createRequestDbMiddleware } from '@libs/app-root-server/request-db-middleware';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { RecordSecretStore } from '@pkgs/secret-store-shared/record-secret-store';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';
import { createHarnessAdapters } from '@pkgs/uuid-shared/harness-adapters';
import { Hono } from 'hono';

test('a harness request preserves a thrown database route error', async () => {
  // regression: request-finally-swallowed-route-error
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileSqliteSchema(db, registerTables(CLIENT_CONFIG_TABLES));
    const ports = createHarnessAdapters({ seed: 1 });
    const app = new Hono()
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
          desiredClientConfig: {
            google: false,
            apple: false,
            billing: false,
            tts: false,
            llm: false,
            googleWebClientId: null,
            emqxWssUrl: null,
            permissionPolicy: {},
            billingGracePeriodMs: 0,
          },
        })
      )
      .get('/broken', () => {
        throw new Error('literal route failure');
      })
      .onError((error, c) => c.json({ error: error.message }, 500));
    const response = await app.request('/broken');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'literal route failure' });
  } finally {
    await db.disconnect();
  }
});

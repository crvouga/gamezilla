import { AUTH_TABLES } from '@libs/auth-shared-ts/tables';
import { HARNESS_AUTH_SECRET } from '@libs/sub-shared-ts/harness-constants';
import { createInProcessOpenAuthSession } from '@pkgs/auth-inhouse-client-ts/in-process-open-auth-session';
import { createAuthApp } from '@pkgs/auth-inhouse-server-ts/create-auth-app';
import { reconcileIdpSqlite } from '@pkgs/auth-inhouse-server-ts/reconcile-idp-sqlite';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { outboxDeliveries, outboxEvents } from '@pkgs/outbox-shared-ts/tables';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import { createHarnessAdapters } from '@pkgs/uuid-shared-ts/harness-adapters';
import {
  ADMIN_TEST_API as API,
  ADMIN_TEST_APPLE as APPLE,
  ADMIN_TEST_GOOGLE as GOOGLE,
  localAdminProviders,
} from './local-admin-providers';

const CALLBACK = 'https://web.local.test/sso-callback';

export async function localAdminFixture() {
  const db = SqlClientImplMockingbirdSqlite.open({ seed: 71 });
  await reconcileIdpSqlite(db);
  await reconcileSqliteSchema(
    db,
    registerTables([...AUTH_TABLES, outboxEvents, outboxDeliveries]),
    { ownership: 'declared-only' }
  );
  const ports = createHarnessAdapters({ seed: 71 });
  const providers = await localAdminProviders(ports.clock);
  const providerFetch = (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    if (request.url.startsWith(GOOGLE)) return providers.google.fetch(request);
    if (request.url.startsWith(APPLE)) return providers.apple.fetch(request);
    throw new Error(`Unexpected provider URL: ${request.url}`);
  };
  const auth = createAuthApp({
    getSql: () => db,
    ...ports,
    secret: HARNESS_AUTH_SECRET,
    baseURL: API,
    trustedOrigins: ['https://web.local.test'],
    providers: providers.config,
    http: { fetch: providerFetch },
  });
  const signIn = async (
    email: string,
    provider: 'google' | 'apple' = 'google'
  ) => {
    const open = createInProcessOpenAuthSession({
      account: { email },
      fetch: async (input, init) => {
        const request = new Request(input, init);
        const response = await (request.url.startsWith(GOOGLE) ||
        request.url.startsWith(APPLE)
          ? providerFetch(request)
          : auth.fetch(request));
        if (!response.ok && response.status !== 302)
          throw new Error(
            `${request.url}: ${response.status} ${await response.text()}`
          );
        return response;
      },
    });
    const result = await open(
      `${API}/auth/oauth/launch?provider=${provider}&callbackUrl=${encodeURIComponent(CALLBACK)}`,
      CALLBACK
    );
    if (result.type !== 'success' || !result.url)
      throw new Error('Local sign-in failed');
    const response = await auth.request(`${API}/auth/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: new URL(result.url).searchParams.get('code'),
      }),
    });
    if (!response.ok)
      throw new Error(`Session exchange failed: ${await response.text()}`);
    return (await response.json()) as { token: string; user: { id: string } };
  };
  return { db, ports, signIn, identities: providers.identities };
}

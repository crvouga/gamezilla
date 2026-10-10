import { createAuthApp } from '@pkgs/auth-inhouse-server/create-auth-app';
import { reconcileIdpSqlite } from '@pkgs/auth-inhouse-server/reconcile-idp-sqlite';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import { createHarnessIds } from '@pkgs/uuid-shared/seeded-create-id';

export const PASSWORD = 'cedar river lantern 37';
export const SECRET = 'password-test-secret-0123456789abcdef';
export async function passwordFixture() {
  const { clock } = createHarnessClock({ startMs: Date.UTC(2026, 0, 1) });
  const { createId } = createHarnessIds(41);
  const db = SqlClientImplMockingbirdSqlite.open({
    seed: 41,
    now: () => new Date(clock.now()),
  });
  await reconcileIdpSqlite(db);
  const deps = {
    getSql: () => db,
    clock,
    createId,
    secret: SECRET,
    baseURL: 'https://auth.example',
    trustedOrigins: ['https://app.example'],
    providers: {},
    http: { fetch: () => Promise.reject(new Error('Unexpected egress')) },
  };
  const apps = [createAuthApp(deps), createAuthApp(deps)];
  const post = (
    path: string,
    value: unknown,
    replica = 0,
    headers: Record<string, string> = {}
  ) =>
    apps[replica]!.request(`https://auth.example/auth/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(value),
    });
  return { db, clock, deps, post };
}

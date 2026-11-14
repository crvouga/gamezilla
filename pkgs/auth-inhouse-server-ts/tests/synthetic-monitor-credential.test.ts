import { expect, test } from 'bun:test';
import { createAuthServerAdapter } from '@pkgs/auth-inhouse-server-ts/create-auth-server-adapter';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import { TOKEN } from './synthetic-monitor-fixture';

function adapter(token: string | null) {
  const sql = SqlClientImplMockingbirdSqlite.open({ seed: 1 });
  return createAuthServerAdapter({
    getSql: () => sql,
    clock: createHarnessClock({ startMs: 0 }).clock,
    createId: () => 'id',
    secret: 'auth-system-secret-0123456789abcdef',
    ...(token === null ? {} : { syntheticMonitor: { token } }),
  });
}

test('the session port recognizes only the configured synthetic-monitor credential', async () => {
  const monitored = adapter(TOKEN);
  expect(await monitored.isSyntheticMonitorCredential?.(TOKEN)).toBe(true);
  for (const presented of ['', 'guess', `${TOKEN}x`, TOKEN.slice(1)])
    expect(await monitored.isSyntheticMonitorCredential?.(presented)).toBe(
      false
    );
  expect(adapter(null).isSyntheticMonitorCredential).toBeUndefined();
});

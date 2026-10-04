// @io-wall-ok — live health: synced client_config rows in the env's Postgres.
/**
 * `specs/runtime/serving-people.feature` and `specs/auth/sign-in.feature`. `/api/health/ready` runs behind the
 * request-db middleware, so any answer from it means the Worker has
 * materialized the rows; a failing readiness dependency is the API
 * feature's to report.
 */

import { expect } from 'bun:test';
import {
  CLIENT_CONFIG_KEYS,
  ClientConfigKey,
} from '@libs/app-config-shared/client-config-keys';
import type { ClientConfigDbRow } from '@libs/app-config-shared/parse-client-config';
import { parseClientConfigRows } from '@libs/app-config-shared/parse-client-config';
import { appPostgresDbScope } from '@libs/db-shared/scope';
import { createPgPool } from '@pkgs/sql-client-postgres-server/connect';
import sql from '@pkgs/sql-shared/sql';
import { eventually, Then, WARMUP_MS } from './define';
import type { LiveWorld } from './live-world';
import { requireSecret } from './live-world';
import { wallWait } from './wall-wait';

const RETRY_MS = 5_000;

export async function liveRows(): Promise<readonly ClientConfigDbRow[]> {
  const { pool, sqlClient } = createPgPool({
    connectionString: requireSecret('DATABASE_URL'),
    dbScope: appPostgresDbScope(),
    max: 1,
  });
  try {
    return await sqlClient.query(sql<ClientConfigDbRow>`
      SELECT id, value, deleted_at FROM client_config WHERE deleted_at IS NULL
    `);
  } finally {
    await pool.end();
  }
}

const API_ANSWERED = 'api-answered';

/**
 * The API materializes the synced client config on its first database
 * request, so a fresh deploy has none until something wakes it: wait (once
 * per scenario) until the API has answered.
 */
export async function awaitApiAnswered(w: LiveWorld): Promise<void> {
  if (w.memo.has(API_ANSWERED)) return;
  const url = `${w.origins.api}/api/health/ready`;
  const answered = await eventually(
    async () => {
      try {
        const res = await w.http.fetch(url);
        await res.body?.cancel();
        // Any Worker answer means the middleware ran; 502/504 are warmup.
        return res.status !== 502 && res.status !== 504;
      } catch {
        return false;
      }
    },
    { maxWaitMs: WARMUP_MS, retryMs: RETRY_MS, ...wallWait }
  );
  expect(answered, `${url} never answered`).toBe(true);
  w.memo.set(API_ANSWERED, true);
}

/** Every client config key is stored. */
Then('the app is given every setting it needs', async (w) => {
  await awaitApiAnswered(w);
  const ids = new Set((await liveRows()).map((r) => r.id));
  expect(CLIENT_CONFIG_KEYS.filter((k) => !ids.has(k))).toEqual([]);
});

Then('people are offered Google sign-in and not Apple sign-in', async (w) => {
  await awaitApiAnswered(w);
  const config = parseClientConfigRows(await liveRows());
  expect(config[ClientConfigKey.googleEnabled]).toBe(true);
  expect(config[ClientConfigKey.appleEnabled]).toBe(false);
});

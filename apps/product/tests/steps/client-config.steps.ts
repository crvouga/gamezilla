// @io-wall-ok — live health: synced client_config rows in the env's Postgres.
/**
 * `specs/health/client-config.feature`. `/api/health/ready` runs behind the
 * request-db middleware, so any answer from it means the Worker has
 * materialized the rows; a failing readiness dependency is the API
 * feature's to report.
 */

import { expect } from 'bun:test';
import {
  CLIENT_CONFIG_KEYS,
  ClientConfigKey,
} from '@libs/client-config/public/client-config-keys';
import {
  type ClientConfigDbRow,
  parseClientConfigRows,
} from '@libs/client-config/public/parse-client-config';
import { appPostgresDbScope } from '@libs/db/public/scope';
import { sql } from '@pkgs/sql';
import { createPgPool } from '@pkgs/sql-client-postgres/connect';
import { eventually, Given, Then, WARMUP_MS } from './define';
import { requireSecret } from './live-world';
import { wallWait } from './wall-wait';

const RETRY_MS = 5_000;

async function liveRows(): Promise<readonly ClientConfigDbRow[]> {
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

Given('the API has answered since its deploy', async (w) => {
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
});

Then('every client config key is stored', async () => {
  const ids = new Set((await liveRows()).map((r) => r.id));
  expect(CLIENT_CONFIG_KEYS.filter((k) => !ids.has(k))).toEqual([]);
});

Then(
  "clients are given the broker's WSS address from the secret store",
  async () => {
    const config = parseClientConfigRows(await liveRows());
    expect(config[ClientConfigKey.emqxWssUrl]).toBe(
      requireSecret('EMQX_WSS_URL')
    );
  }
);

Then('clients are offered Google sign-in and not Apple sign-in', async () => {
  const config = parseClientConfigRows(await liveRows());
  expect(config[ClientConfigKey.googleEnabled]).toBe(true);
  expect(config[ClientConfigKey.appleEnabled]).toBe(false);
});

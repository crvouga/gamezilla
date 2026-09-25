// @io-wall-ok — live health probe (synced client_config rows in the env's Postgres).
import { beforeAll, describe, expect, test } from 'bun:test';
import {
  CLIENT_CONFIG_KEYS,
  ClientConfigKey,
} from '@libs/client-config/public/client-config-keys';
import {
  type ClientConfigDbRow,
  parseClientConfigRows,
} from '@libs/client-config/public/parse-client-config';
import { appPostgresDbScope } from '@libs/db/public/scope';
import { envOrigins } from '@libs/infra/public/env-file';
import { envFile } from '@libs/infra/public/envs';
import { waitForHttp } from '@libs/secrets/shared/wait-for-http';
import { sql } from '@pkgs/sql';
import { createPgPool } from '@pkgs/sql-client-postgres/connect';

async function liveRows(): Promise<readonly ClientConfigDbRow[]> {
  const url = process.env['DATABASE_URL']?.trim() ?? '';
  expect(url, 'DATABASE_URL missing from secrets env').not.toBe('');
  const { pool, sqlClient } = createPgPool({
    connectionString: url,
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

/** Right after a deploy the custom domain may still be warming up. */
const WARMUP_MS = 5 * 60 * 1000;

/**
 * The API Worker materializes `client_config` from its bindings on its first
 * database request, so a fresh deploy has no rows until something calls it.
 * `/api/health/ready` runs behind the request-db middleware — answering it
 * means the Worker has materialized. Values are read through the
 * same parser the client uses.
 */
describe('client config', () => {
  beforeAll(async () => {
    const env = envFile(process.env['SECRETS_ENV']?.trim() || 'dev');
    await waitForHttp(`${envOrigins(env).api}/api/health/ready`, {
      label: 'API /api/health/ready (materializes client_config)',
      maxWaitMs: WARMUP_MS,
      // Any Worker answer means the middleware ran; 502/504 are still warmup.
      // A failing readiness dependency is api-worker.health's to report.
      accept: (r) =>
        r.status !== undefined &&
        r.status > 0 &&
        r.status !== 502 &&
        r.status !== 504,
    });
  }, WARMUP_MS + 30_000);

  test('every client config key is materialized', async () => {
    const ids = new Set((await liveRows()).map((r) => r.id));
    expect(CLIENT_CONFIG_KEYS.filter((k) => !ids.has(k))).toEqual([]);
  });

  test('clients get the broker WSS URL from secrets', async () => {
    const config = parseClientConfigRows(await liveRows());
    const wss = process.env['EMQX_WSS_URL']?.trim() ?? '';
    expect(wss, 'EMQX_WSS_URL missing from secrets env').not.toBe('');
    expect(config[ClientConfigKey.emqxWssUrl]).toBe(wss);
  });

  test('production sign-in methods: Google on, mock Apple off', async () => {
    const config = parseClientConfigRows(await liveRows());
    expect(config[ClientConfigKey.googleEnabled]).toBe(true);
    expect(config[ClientConfigKey.appleEnabled]).toBe(false);
  });
});

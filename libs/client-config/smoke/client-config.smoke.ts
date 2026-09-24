// @io-wall-ok — live smoke probe (synced client_config rows in the env's Postgres).
import { describe, expect, test } from 'bun:test';
import {
  CLIENT_CONFIG_KEYS,
  ClientConfigKey,
} from '@libs/client-config/public/client-config-keys';
import {
  type ClientConfigDbRow,
  parseClientConfigRows,
} from '@libs/client-config/public/parse-client-config';
import { appPostgresDbScope } from '@libs/db/public/scope';
import { isProductionSecretsEnv } from '@pkgs/secrets-config/deploy-mode';
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

/**
 * The API Worker materializes `client_config` from its bindings on its first
 * database request, so only prd (the env with a deployed Worker) is checked.
 * Values are read through the same parser the client uses.
 */
describe.skipIf(!isProductionSecretsEnv())('client config (prd)', () => {
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

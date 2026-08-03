import { isEqual } from '@pkgs/equal/is-equal';
import type { Logger } from '@pkgs/logger';
import { sql } from '@pkgs/sql';

import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Context } from 'hono';
import { Hono } from 'hono';

import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import {
  CLIENT_CONFIG_ENTITY_ID,
  ClientConfigAttr,
} from '../shared/client-config-entities';

export type ClientConfigRefreshOutcome = 'unchanged' | 'updated';

export type ClientConfigRefreshResponseBody = {
  ok: true;
  outcome: ClientConfigRefreshOutcome;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
};

function snapshotAttributes(
  attrs: Record<string, unknown> | undefined
): Record<string, unknown> | null {
  if (attrs === undefined) return null;
  return { ...attrs };
}

function loadClientConfigAttributes(): Record<string, unknown> {
  return ClientConfigAttr.googleWebClientId(null);
}

async function readClientConfigRow(
  db: SqlClient
): Promise<Record<string, unknown> | null> {
  const rows = await db.query(sql<Record<string, unknown>>`
    SELECT google_web_client_id
    FROM client_config
    WHERE id = ${CLIENT_CONFIG_ENTITY_ID}
    LIMIT 1
  `);
  const row = rows[0];
  if (row === undefined) return null;
  return {
    [ClientConfigAttr.googleWebClientId.key]:
      row['google_web_client_id'] ?? null,
  };
}

async function upsertClientConfigRow(
  db: SqlClient,
  attrs: Record<string, unknown>
): Promise<void> {
  const googleId = attrs[ClientConfigAttr.googleWebClientId.key];
  const googleWebClientId = typeof googleId === 'string' ? googleId : null;
  await db.run(sql<void>`
    INSERT INTO client_config (id, google_web_client_id)
    VALUES (${CLIENT_CONFIG_ENTITY_ID}, ${googleWebClientId})
    ON CONFLICT (id) DO UPDATE SET
      google_web_client_id = EXCLUDED.google_web_client_id
  `);
}

async function handleClientConfigRefresh(
  c: Context<ApiHonoEnv>,
  deps: { logger: Logger }
): Promise<Response> {
  const db = c.get('sqlClient');
  const { logger } = deps;
  logger.info('POST /client-config/refresh: requested');
  const configNew = loadClientConfigAttributes();
  const configPrev = await readClientConfigRow(db);
  const before = snapshotAttributes(configPrev ?? undefined);
  logger.debug('Client config comparison', { configPrev, configNew });

  if (isEqual(configPrev, configNew)) {
    logger.info('No changes to client config; skipping write.', {
      outcome: 'unchanged',
      before,
      after: before,
    });
    const body: ClientConfigRefreshResponseBody = {
      ok: true,
      outcome: 'unchanged',
      before,
      after: before,
    };
    return c.json(body, 200);
  }

  logger.info('Updating client config', { config: configNew });
  await upsertClientConfigRow(db, configNew);
  const after = snapshotAttributes(
    (await readClientConfigRow(db)) ?? undefined
  );

  logger.info('Client config updated successfully.', {
    outcome: 'updated',
    before,
    after,
  });
  const body: ClientConfigRefreshResponseBody = {
    ok: true,
    outcome: 'updated',
    before,
    after,
  };
  return c.json(body, 200);
}

export function createClientConfigApp(logger: Logger) {
  return new Hono<ApiHonoEnv>().post('/client-config/refresh', async (c) =>
    handleClientConfigRefresh(c, { logger })
  );
}

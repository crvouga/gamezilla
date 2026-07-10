import { isEqual } from '@pkgs/equal/is-equal';
import type { Logger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Context } from 'hono';
import { Hono } from 'hono';

import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import {
  CLIENT_CONFIG_ENTITY_ID,
  ClientConfigAttr,
} from '../shared/client-config-entities';
import {
  ClientConfigCol,
  CLIENT_CONFIG_TABLE,
} from '@libs/db/shared/client-config-tables';

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
  sql: SqlClient
): Promise<Record<string, unknown> | null> {
  const rows = await sql.query<Record<string, unknown>>(
    `SELECT * FROM ${CLIENT_CONFIG_TABLE.tableName} WHERE ${ClientConfigCol.id} = ? LIMIT 1`,
    [CLIENT_CONFIG_ENTITY_ID]
  );
  const row = rows[0];
  if (row === undefined) return null;
  return {
    [ClientConfigAttr.googleWebClientId.key]: row[ClientConfigCol.googleWebClientId] ?? null,
  };
}

async function upsertClientConfigRow(
  sql: SqlClient,
  attrs: Record<string, unknown>
): Promise<void> {
  const googleId = attrs[ClientConfigAttr.googleWebClientId.key];
  await sql.run(
    `INSERT INTO ${CLIENT_CONFIG_TABLE.tableName}
     (${ClientConfigCol.id}, ${ClientConfigCol.googleWebClientId})
     VALUES (?, ?)
     ON CONFLICT (${ClientConfigCol.id}) DO UPDATE SET
       ${ClientConfigCol.googleWebClientId} = excluded.${ClientConfigCol.googleWebClientId}`,
    [CLIENT_CONFIG_ENTITY_ID, typeof googleId === 'string' ? googleId : null]
  );
}

async function handleClientConfigRefresh(
  c: Context<ApiHonoEnv>,
  deps: { logger: Logger }
): Promise<Response> {
  const sql = c.get('sqlClient');
  const { logger } = deps;
  logger.info('POST /client-config/refresh: requested');
  const configNew = loadClientConfigAttributes();
  const configPrev = await readClientConfigRow(sql);
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
  await upsertClientConfigRow(sql, configNew);
  const after = snapshotAttributes(await readClientConfigRow(sql) ?? undefined);

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

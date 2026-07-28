import { isEqual } from '@pkgs/equal/is-equal';
import type { Logger } from '@pkgs/logger';
import { sql, ident } from '@pkgs/sql';
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
  db: SqlClient
): Promise<Record<string, unknown> | null> {
  const rows = await db.query<Record<string, unknown>>(sql`
    SELECT * FROM ${ident(CLIENT_CONFIG_TABLE.tableName)} WHERE ${ident(ClientConfigCol.id)} = ${CLIENT_CONFIG_ENTITY_ID} LIMIT 1
  `);
  const row = rows[0];
  if (row === undefined) return null;
  return {
    [ClientConfigAttr.googleWebClientId.key]:
      row[ClientConfigCol.googleWebClientId] ?? null,
  };
}

async function upsertClientConfigRow(
  db: SqlClient,
  attrs: Record<string, unknown>
): Promise<void> {
  const googleId = attrs[ClientConfigAttr.googleWebClientId.key];
  await db.run(sql`
    INSERT INTO ${ident(CLIENT_CONFIG_TABLE.tableName)}
     (${ident(ClientConfigCol.id)}, ${ident(ClientConfigCol.googleWebClientId)})
     VALUES (${CLIENT_CONFIG_ENTITY_ID}, ${typeof googleId === 'string' ? googleId : null})
     ON CONFLICT (${ident(ClientConfigCol.id)}) DO UPDATE SET
       ${ident(ClientConfigCol.googleWebClientId)} = excluded.${ident(ClientConfigCol.googleWebClientId)}
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

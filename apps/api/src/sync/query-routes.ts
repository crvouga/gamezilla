import { assert } from '@pkgs/assert';
import { runQuery } from '@pkgs/queries/server/run-query';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';

import type { ApiHonoEnv } from '../app/api-hono-types';
import type { AuthContext } from '@libs/auth/server/types';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import { APP_QUERIES } from './app-queries';
import { isAuthErrorBody, resolveSessionReplayAuth } from './query-auth';

const bodySchema = z.object({
  name: z.string().min(1),
  params: z.unknown().default({}),
  lastHash: z.string().optional(),
  checkpoint: z.string().optional(),
});

let checkpointSeq = 0;

function nextCheckpoint(): string {
  checkpointSeq += 1;
  return `${Date.now()}${String(checkpointSeq).padStart(6, '0')}`;
}

function openRequestSqlClient(): SqlClient {
  const requestStore = apiRequestAsyncLocalStorage.getStore();
  assert.defined(requestStore, 'query sql: request store missing');
  return requestStore.sqlClient;
}

async function handleQuery(
  c: Context<ApiHonoEnv<AuthContext>>
): Promise<Response> {
  const auth = await resolveSessionReplayAuth(c.req.raw);
  if (isAuthErrorBody(auth)) {
    return c.json(auth, 401);
  }
  const parsed = bodySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ status: 'gone' as const }, 400);
  }
  const body = parsed.data;
  const response = await runQuery(
    {
      db: openRequestSqlClient(),
      registry: APP_QUERIES,
      auth: { ...auth, now: () => new Date() },
      nextCheckpoint,
    },
    {
      name: body.name,
      params: body.params,
      ...(body.lastHash !== undefined ? { lastHash: body.lastHash } : {}),
      ...(body.checkpoint !== undefined
        ? { checkpoint: body.checkpoint }
        : {}),
    }
  );
  return c.json(response, 200);
}

/** `POST /api/query` — authorize-first defineQuery runner. */
export function createQueryRoutes() {
  return new Hono<ApiHonoEnv<AuthContext>>().post('/query', (c) =>
    handleQuery(c)
  );
}

import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Hono } from 'hono';
import { z } from 'zod';

import type { AuthErrorBody, QueryRegistry } from '../queries/core/types';
import { runQuery } from '../queries/server/run-query';
import { isAuthErrorBody } from './auth-error';
import {
  resolveRequestSql,
  type SyncSqlVariables,
} from './resolve-request-sql';
import type { SyncAppAuth } from './sync-app-auth';
import { assertSyncProtocol } from './sync-protocol-gate';

const queryItemSchema = z.object({
  name: z.string().min(1),
  params: z.unknown().default({}),
  lastHash: z.string().optional(),
  checkpoint: z.string().optional(),
});

const queryBodySchema = z.object({
  queries: z.array(queryItemSchema).min(1).max(64),
});

type RunQueryDeps = {
  readonly db: SqlClient;
  readonly registry: QueryRegistry;
  readonly auth: SyncAppAuth & { readonly now: () => Date };
  readonly nextCheckpoint: () => string;
  readonly strictQueryLimits?: boolean;
};

async function runOne(
  deps: RunQueryDeps,
  body: z.infer<typeof queryItemSchema>
) {
  return runQuery(deps, {
    name: body.name,
    params: body.params,
    ...(body.lastHash !== undefined ? { lastHash: body.lastHash } : {}),
    ...(body.checkpoint !== undefined ? { checkpoint: body.checkpoint } : {}),
  });
}

export type MountQueryRoutesDeps = {
  readonly resolveAuth: (
    request: Request
  ) => Promise<SyncAppAuth | AuthErrorBody>;
  readonly getSql: () => SqlClient;
  readonly queries: QueryRegistry;
  readonly nextCheckpoint: () => string;
  readonly now: () => number;
  readonly strictQueryLimits?: boolean;
};

export function mountQueryRoutes(
  app: Hono<{ Variables: SyncSqlVariables }>,
  deps: MountQueryRoutesDeps
): void {
  app.post('/query', async (c) => {
    // Capture before awaits — Hono vars are request-pinned; ALS getSql can race
    // under stack ALS when concurrent requests overlap.
    const db = resolveRequestSql(c, deps.getSql);
    const protocolErr = assertSyncProtocol(c.req.raw);
    if (protocolErr !== null) return c.json(protocolErr, 401);
    const auth = await deps.resolveAuth(c.req.raw);
    if (isAuthErrorBody(auth)) {
      return c.json(auth, 401);
    }
    const parsed = queryBodySchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ status: 'denied' as const }, 400);
    }
    const runDeps: RunQueryDeps = {
      db,
      registry: deps.queries,
      auth: { ...auth, now: () => new Date(deps.now()) },
      nextCheckpoint: deps.nextCheckpoint,
      ...(deps.strictQueryLimits === true ? { strictQueryLimits: true } : {}),
    };
    const responses = [];
    for (const item of parsed.data.queries) {
      responses.push(await runOne(runDeps, item));
    }
    return c.json({ responses }, 200);
  });
}

import { assert } from '@pkgs/assert-shared/singleton';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import type { Hono } from 'hono';

import type { AuthErrorBody } from '@pkgs/sync-engine-shared/v2';
import type { QueryRegistry } from '@pkgs/sync-engine-shared/queries-types';
import { runQuery } from './run-query';
import { isAuthErrorBody } from './auth-error';
import { parseQueryBatchBody } from './parse-batch-body';
import type { QueryBatchItem } from './parse-batch-body';
import { resolveRequestSql } from './resolve-request-sql';
import type { SyncSqlVariables } from './resolve-request-sql';
import type { SyncAppAuth } from './sync-app-auth';
import { assertSyncProtocol } from './sync-protocol-gate';

type RunQueryDeps = {
  readonly db: SqlClient;
  readonly registry: QueryRegistry;
  readonly auth: SyncAppAuth & { readonly now: () => Date };
  readonly nextCheckpoint: () => string;
  readonly strictQueryLimits?: boolean;
};

async function runOne(deps: RunQueryDeps, body: QueryBatchItem) {
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
  // One function per app. People search buckets its rate limit by `env.now`,
  // so harnesses that share a process do not share a budget.
  const now = (): Date => new Date(deps.now());
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
    const parsed = parseQueryBatchBody(await c.req.json());
    if (parsed === null) {
      return c.json({ status: 'denied' as const }, 400);
    }
    const runDeps: RunQueryDeps = {
      db,
      registry: deps.queries,
      auth: { ...auth, now },
      nextCheckpoint: deps.nextCheckpoint,
      ...(deps.strictQueryLimits === true ? { strictQueryLimits: true } : {}),
    };
    const responses = [];
    for (const item of parsed.queries) {
      responses.push(await runOne(runDeps, item));
    }
    assert.equals(
      responses.length,
      parsed.queries.length,
      'query batch response count'
    );
    return c.json({ responses }, 200);
  });
}

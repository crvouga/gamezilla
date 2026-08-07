import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Hono } from 'hono';
import { z } from 'zod';

import type { AuthErrorBody, QueryRegistry } from '../queries/core/types';
import { runQuery } from '../queries/server/run-query';
import { isAuthErrorBody } from './auth-error';
import type { SyncAppAuth } from './sync-app-auth';

const queryItemSchema = z.object({
  name: z.string().min(1),
  params: z.unknown().default({}),
  lastHash: z.string().optional(),
  checkpoint: z.string().optional(),
});

const batchBodySchema = z.object({
  queries: z.array(queryItemSchema).min(1).max(64),
});

type RunQueryDeps = {
  readonly db: SqlClient;
  readonly registry: QueryRegistry;
  readonly auth: SyncAppAuth & { readonly now: () => Date };
  readonly nextCheckpoint: () => string;
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
};

export function mountQueryRoutes(app: Hono, deps: MountQueryRoutesDeps): void {
  app.post('/query', async (c) => {
    const auth = await deps.resolveAuth(c.req.raw);
    if (isAuthErrorBody(auth)) {
      return c.json(auth, 401);
    }
    const parsed = queryItemSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ status: 'gone' as const }, 400);
    }
    const response = await runOne(
      {
        db: deps.getSql(),
        registry: deps.queries,
        auth: { ...auth, now: () => new Date() },
        nextCheckpoint: deps.nextCheckpoint,
      },
      parsed.data
    );
    return c.json(response, 200);
  });

  app.post('/query/batch', async (c) => {
    const auth = await deps.resolveAuth(c.req.raw);
    if (isAuthErrorBody(auth)) {
      return c.json(auth, 401);
    }
    const parsed = batchBodySchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ status: 'gone' as const }, 400);
    }
    const runDeps: RunQueryDeps = {
      db: deps.getSql(),
      registry: deps.queries,
      auth: { ...auth, now: () => new Date() },
      nextCheckpoint: deps.nextCheckpoint,
    };
    const responses = [];
    for (const item of parsed.data.queries) {
      responses.push(await runOne(runDeps, item));
    }
    return c.json({ responses }, 200);
  });
}

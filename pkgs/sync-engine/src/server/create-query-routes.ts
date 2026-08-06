import type { SqlClient } from '@pkgs/sql-client/interface';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AuthErrorBody, QueryRegistry } from '../queries/core/types';
import { runQuery } from '../queries/server/run-query';
import { isAuthErrorBody } from './auth-error';

const queryItemSchema = z.object({
  name: z.string().min(1),
  params: z.unknown().default({}),
  lastHash: z.string().optional(),
  checkpoint: z.string().optional(),
});

const bodySchema = queryItemSchema;

const batchBodySchema = z.object({
  queries: z.array(queryItemSchema).min(1).max(64),
});

export type QueryRouteAuth = {
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
};

export type CreateQueryRoutesDeps = {
  readonly resolveAuth: (
    request: Request
  ) => Promise<QueryRouteAuth | AuthErrorBody>;
  readonly getSql: () => SqlClient;
  readonly registry: QueryRegistry;
  readonly nextCheckpoint?: () => string;
};

let checkpointSeq = 0;

function defaultNextCheckpoint(): string {
  checkpointSeq += 1;
  return `${Date.now()}${String(checkpointSeq).padStart(6, '0')}`;
}

type RunDeps = {
  readonly db: SqlClient;
  readonly registry: QueryRegistry;
  readonly auth: QueryRouteAuth & { readonly now: () => Date };
  readonly nextCheckpoint: () => string;
};

async function runOne(deps: RunDeps, body: z.infer<typeof queryItemSchema>) {
  return runQuery(deps, {
    name: body.name,
    params: body.params,
    ...(body.lastHash !== undefined ? { lastHash: body.lastHash } : {}),
    ...(body.checkpoint !== undefined ? { checkpoint: body.checkpoint } : {}),
  });
}

/** `POST /query` + `POST /query/batch` — authorize-first defineQuery runners. */
export function createQueryRoutes(deps: CreateQueryRoutesDeps) {
  const nextCheckpoint = deps.nextCheckpoint ?? defaultNextCheckpoint;
  const app = new Hono();

  app.post('/query', async (c) => {
    const auth = await deps.resolveAuth(c.req.raw);
    if (isAuthErrorBody(auth)) {
      return c.json(auth, 401);
    }
    const parsed = bodySchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ status: 'gone' as const }, 400);
    }
    const response = await runOne(
      {
        db: deps.getSql(),
        registry: deps.registry,
        auth: { ...auth, now: () => new Date() },
        nextCheckpoint,
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
    const runDeps: RunDeps = {
      db: deps.getSql(),
      registry: deps.registry,
      auth: { ...auth, now: () => new Date() },
      nextCheckpoint,
    };
    const responses = [];
    for (const item of parsed.data.queries) {
      responses.push(await runOne(runDeps, item));
    }
    return c.json({ responses }, 200);
  });

  return app;
}

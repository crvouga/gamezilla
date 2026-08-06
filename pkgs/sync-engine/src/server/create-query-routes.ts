import type { SqlClient } from '@pkgs/sql-client/interface';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AuthErrorBody, QueryRegistry } from '../queries/core/types';
import { runQuery } from '../queries/server/run-query';
import { isAuthErrorBody } from './auth-error';

const bodySchema = z.object({
  name: z.string().min(1),
  params: z.unknown().default({}),
  lastHash: z.string().optional(),
  checkpoint: z.string().optional(),
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

/** `POST /query` — authorize-first defineQuery runner. */
export function createQueryRoutes(deps: CreateQueryRoutesDeps) {
  const nextCheckpoint = deps.nextCheckpoint ?? defaultNextCheckpoint;
  return new Hono().post('/query', async (c) => {
    const auth = await deps.resolveAuth(c.req.raw);
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
        db: deps.getSql(),
        registry: deps.registry,
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
  });
}

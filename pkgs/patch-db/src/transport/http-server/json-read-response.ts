import { AssertCrashError } from '@pkgs/assert';
import type { Context } from 'hono';
import { ForbiddenError } from '../../forbidden-error';
import {
  stripKnownPatchesFromQuery,
  type PatchDbContext,
  type PatchDbQuery,
} from '../../interface';
import type { PatchDbSyncHost } from '../interface';
import { applyNoCacheHeaders } from './no-cache';

export async function jsonReadResponse(
  c: Context,
  host: PatchDbSyncHost,
  queries: PatchDbQuery[],
  ctx: PatchDbContext
): Promise<Response> {
  try {
    const results = await host.read(queries, ctx);
    const stripped = results.map((r) => ({
      ...r,
      query: stripKnownPatchesFromQuery(r.query),
    }));
    applyNoCacheHeaders(c);
    return c.json({ results: stripped }, 200);
  } catch (e: unknown) {
    if (e instanceof ForbiddenError) {
      return c.json({ error: e.message }, 403);
    }
    if (e instanceof AssertCrashError) {
      return c.json(
        {
          error: e.message,
          kind: 'assertCrash' as const,
          ...(e.context !== undefined ? { context: e.context } : {}),
        },
        500
      );
    }
    throw e;
  }
}

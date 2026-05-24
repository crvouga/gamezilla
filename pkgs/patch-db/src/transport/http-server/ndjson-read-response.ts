import { AssertCrashError } from '@pkgs/assert';
import { acceptsNdjson } from '@pkgs/ndjson/client';
import {
  encodeNdjsonReadableStream,
  streamParallelIndexed,
} from '@pkgs/ndjson/server';
import {
  NDJSON_CONTENT_TYPE,
  type NdjsonErrorFrame,
} from '@pkgs/ndjson/shared';
import type { Context } from 'hono';
import { ForbiddenError } from '../../forbidden-error';
import {
  stripKnownPatchesFromQuery,
  type PatchDbContext,
  type PatchDbQuery,
  type PatchDbResult,
} from '../../interface';
import type { PatchDbSyncHost } from '../interface';
import { applyNoCacheHeaders } from './no-cache';

function clientWantsNdjson(c: Context): boolean {
  return acceptsNdjson(c.req.header('accept'));
}

function statusFromError(e: unknown): number {
  if (e instanceof ForbiddenError) return 403;
  return 500;
}

function messageFromError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

/**
 * Build a wire error frame for a per-query (or tail) failure. When the
 * failure is an {@link AssertCrashError}, the frame carries
 * `kind: 'assertCrash'` and the original structured context so the
 * client can re-raise the same crash locally via its registered crash
 * handler chain — preserving the original message + context for the
 * overlay / telemetry.
 */
function frameFromError(index: number, e: unknown): NdjsonErrorFrame {
  const status = statusFromError(e);
  const message = messageFromError(e);
  if (e instanceof AssertCrashError) {
    return {
      frame: 'error',
      index,
      status,
      message,
      kind: 'assertCrash',
      ...(e.context !== undefined ? { context: e.context } : {}),
    };
  }
  return { frame: 'error', index, status, message };
}

function runQuery(
  host: PatchDbSyncHost,
  queries: readonly PatchDbQuery[],
  ctx: PatchDbContext,
  index: number
): Promise<PatchDbResult> {
  return host.read([queries[index]!], ctx).then((rs) => ({
    ...rs[0]!,
    query: stripKnownPatchesFromQuery(rs[0]!.query),
  }));
}

export function ndjsonReadResponse(
  c: Context,
  host: PatchDbSyncHost,
  queries: readonly PatchDbQuery[],
  ctx: PatchDbContext
): Response {
  applyNoCacheHeaders(c);
  c.header('Content-Type', NDJSON_CONTENT_TYPE);
  const frames = streamParallelIndexed<PatchDbResult>(
    queries.length,
    (index) => runQuery(host, queries, ctx, index),
    frameFromError
  );
  const body = encodeNdjsonReadableStream(frames, {
    mapTailError: (e) => frameFromError(-1, e),
  });
  return c.body(body, 200);
}

export { clientWantsNdjson };

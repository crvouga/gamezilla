import { Assert } from '@pkgs/assert';
import { zValidator } from '@hono/zod-validator';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { ForbiddenError } from '../forbidden-error';
import {
  OPEN_PATCHES_DB_CONTEXT,
  assertPatchDbContext,
  assertQuery,
  assertWirePatchInput,
  stripKnownPatchesFromQuery,
  type PatchDbContext,
  type PatchDbQuery,
  type PatchDbResult,
  type PatchInput,
} from '../interface';
import type { PatchDbSyncHost } from './interface';
import {
  NDJSON_CONTENT_TYPE,
  encodeNdjsonFrame,
  type NdjsonReadFrame,
} from './ndjson';
import {
  DEFAULT_BASE_PATH,
  NO_CACHE_RESPONSE_HEADERS,
  PATCH_SUFFIX_READ,
  PATCH_SUFFIX_WRITE,
  patchDbPaths,
} from './paths';
import { patchDbReadBodySchema, patchDbWriteBodySchema } from './wire-schemas';

type ResolvedPaths = ReturnType<typeof patchDbPaths>;

function applyNoCacheHeaders(c: Context): void {
  for (const [k, v] of Object.entries(NO_CACHE_RESPONSE_HEADERS)) {
    c.header(k, v);
  }
}

function clientWantsNdjson(c: Context): boolean {
  const accept = c.req.header('accept') ?? '';
  return accept.includes(NDJSON_CONTENT_TYPE);
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
 * Issues every query in parallel against the host and yields NDJSON
 * frames in completion order, terminating with a single `end` frame.
 * Per-query errors become inline `error` frames so a slow / forbidden
 * query never blocks faster siblings in the same request.
 */
async function* streamReadFrames(
  host: PatchDbSyncHost,
  queries: readonly PatchDbQuery[],
  ctx: PatchDbContext
): AsyncIterable<NdjsonReadFrame> {
  type Pending = Promise<{
    readonly index: number;
    readonly result?: PatchDbResult;
    readonly error?: unknown;
  }>;
  const pending = new Map<number, Pending>();
  for (let i = 0; i < queries.length; i++) {
    const index = i;
    const p: Pending = host
      .read([queries[i]!], ctx)
      .then((rs) => ({ index, result: rs[0]! }))
      .catch((error: unknown) => ({ index, error }));
    pending.set(index, p);
  }
  while (pending.size > 0) {
    const winner = await Promise.race(pending.values());
    pending.delete(winner.index);
    if (winner.error !== undefined) {
      yield {
        frame: 'error',
        index: winner.index,
        status: statusFromError(winner.error),
        message: messageFromError(winner.error),
      };
      continue;
    }
    const r = winner.result;
    if (r === undefined) continue;
    yield {
      frame: 'result',
      index: winner.index,
      result: { ...r, query: stripKnownPatchesFromQuery(r.query) },
    };
  }
  yield { frame: 'end' };
}

function ndjsonReadResponse(
  c: Context,
  host: PatchDbSyncHost,
  queries: readonly PatchDbQuery[],
  ctx: PatchDbContext
): Response {
  for (const [k, v] of Object.entries(NO_CACHE_RESPONSE_HEADERS)) {
    c.header(k, v);
  }
  c.header('Content-Type', NDJSON_CONTENT_TYPE);
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const frame of streamReadFrames(host, queries, ctx)) {
          controller.enqueue(encoder.encode(encodeNdjsonFrame(frame)));
        }
        controller.close();
      } catch (e: unknown) {
        // A throw escaped per-query catch — almost always a hook /
        // enrichContext bug. Emit a terminal error frame at index -1 so
        // the client surfaces the failure rather than silently truncating.
        const tail: NdjsonReadFrame = {
          frame: 'error',
          index: -1,
          status: statusFromError(e),
          message: messageFromError(e),
        };
        controller.enqueue(encoder.encode(encodeNdjsonFrame(tail)));
        controller.enqueue(
          encoder.encode(encodeNdjsonFrame({ frame: 'end' }))
        );
        controller.close();
      }
    },
  });
  return c.body(body, 200);
}

export type PatchDbHttpAuthOptions = {
  resolvePatchDbContext?: (
    req: Request
  ) => Promise<PatchDbContext | null | undefined>;
  /** When true, missing / null context from resolver yields 401. */
  requirePatchDbAuth?: boolean;
};

async function resolveRequestContext(
  c: Context,
  auth: PatchDbHttpAuthOptions | undefined
): Promise<
  | { ok: true; ctx: PatchDbContext }
  | { ok: false; status: 401 | 403; message: string }
> {
  const resolve = auth?.resolvePatchDbContext;
  if (resolve === undefined) {
    return { ok: true, ctx: OPEN_PATCHES_DB_CONTEXT };
  }
  try {
    const resolved = await resolve(c.req.raw);
    if (resolved === null || resolved === undefined) {
      if (auth?.requirePatchDbAuth === true) {
        return { ok: false, status: 401, message: 'Unauthorized' };
      }
      return { ok: true, ctx: OPEN_PATCHES_DB_CONTEXT };
    }
    assertPatchDbContext(resolved, Assert.validation());
    return { ok: true, ctx: resolved };
  } catch (e: unknown) {
    if (e instanceof ForbiddenError) {
      return { ok: false, status: 403, message: e.message };
    }
    throw e;
  }
}

function assertReadBody(body: unknown): asserts body is {
  queries: PatchDbQuery[];
} {
  const a: Assert = Assert.validation();
  a.record(body, 'Request body must be object');
  const b = body as { queries?: unknown };
  a.field(b, 'queries', 'queries required');
  a.array(b.queries, 'queries required');
  a.ok((b.queries as unknown[]).length > 0, 'queries must not be empty');
  a.all(b.queries as unknown[], (q): asserts q is PatchDbQuery =>
    assertQuery(a, q)
  );
}

async function readHandler(
  c: Context,
  host: PatchDbSyncHost,
  auth: PatchDbHttpAuthOptions | undefined
): Promise<Response> {
  const authResult = await resolveRequestContext(c, auth);
  if (!authResult.ok) {
    return c.json({ error: authResult.message }, authResult.status);
  }
  const body: unknown = (c.req as { valid: (k: 'json') => unknown }).valid(
    'json'
  );
  assertReadBody(body);
  const { queries } = body;
  if (clientWantsNdjson(c)) {
    return ndjsonReadResponse(c, host, queries, authResult.ctx);
  }
  try {
    const results = await host.read(queries, authResult.ctx);
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
    throw e;
  }
}

/**
 * Hono sub-app routes (paths relative to {@link patchDbPaths} `basePath` mount).
 * Matches wire URLs `{base}/patches/read` and `{base}/patches/write`.
 */
export function createPatchDbHttpHono(
  host: PatchDbSyncHost,
  auth?: PatchDbHttpAuthOptions
) {
  return new Hono()
    .post(
      PATCH_SUFFIX_READ,
      zValidator('json', patchDbReadBodySchema),
      async (c) => readHandler(c, host, auth)
    )
    .post(
      PATCH_SUFFIX_WRITE,
      zValidator('json', patchDbWriteBodySchema),
      async (c) => {
        const authResult = await resolveRequestContext(c, auth);
        if (!authResult.ok) {
          return c.json({ error: authResult.message }, authResult.status);
        }
        const body = c.req.valid('json');
        const a: Assert = Assert.validation();
        a.record(body, 'Request body must be object');
        a.field(body, 'patches', 'patches required');
        a.array(body.patches, 'patches required');
        a.ok(body.patches.length > 0, 'patches must not be empty');
        a.all(body.patches, (p): asserts p is PatchInput =>
          assertWirePatchInput(a, p)
        );
        const out = await host.write(body.patches, authResult.ctx);
        applyNoCacheHeaders(c);
        return c.json(
          {
            accepted: out.accepted,
            rejected: out.rejected,
          },
          200
        );
      }
    );
}

/**
 * HTTP adapter: Hono routes validate wire JSON and delegate to {@link PatchDbSyncHost}.
 * Mount with `parent.route(basePath, handler.honoApp)` or call {@link handleRequest}.
 */
export class PatchDbHttpRequestHandler {
  readonly honoApp: ReturnType<typeof createPatchDbHttpHono>;
  private readonly paths: ResolvedPaths;

  constructor(
    host: PatchDbSyncHost,
    basePath: string = DEFAULT_BASE_PATH,
    auth?: PatchDbHttpAuthOptions
  ) {
    this.paths = patchDbPaths(basePath);
    this.honoApp = createPatchDbHttpHono(host, auth);
  }

  /**
   * Returns a {@link Response} for patch-db routes, or `null` if this request does not match
   * the wire paths (so outer routers can fall through).
   */
  async handleRequest(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith(this.paths.basePath)) {
      return null;
    }
    const rest =
      url.pathname.length === this.paths.basePath.length
        ? ''
        : url.pathname.slice(this.paths.basePath.length);
    if (rest !== PATCH_SUFFIX_READ && rest !== PATCH_SUFFIX_WRITE) {
      return null;
    }
    if (req.method !== 'POST') {
      return null;
    }
    const inner = new Request(
      new URL(`${rest}${url.search}`, 'http://patch-db.hono/'),
      req.clone()
    );
    return this.honoApp.fetch(inner);
  }
}

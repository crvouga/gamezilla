import { Assert } from '@gamezilla/lib/assert';
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
  type PatchInput,
} from '../interface';
import type { PatchDbSyncHost } from './interface';
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
      async (c) => {
        const authResult = await resolveRequestContext(c, auth);
        if (!authResult.ok) {
          return c.json({ error: authResult.message }, authResult.status);
        }
        const body = c.req.valid('json');
        const a: Assert = Assert.validation();
        a.record(body, 'Request body must be object');
        a.field(body, 'queries', 'queries required');
        a.array(body.queries, 'queries required');
        a.ok(body.queries.length > 0, 'queries must not be empty');
        a.all(body.queries, (q): asserts q is PatchDbQuery =>
          assertQuery(a, q)
        );
        const queries = body.queries;
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

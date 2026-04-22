import { zValidator } from '@hono/zod-validator';
import { Assert } from '@gamezilla/shared/assert';
import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  type PatchInput,
  type PatchesDbQuery,
  assertPatchInput,
  assertQuery,
  stripKnownPatchesFromQuery,
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

/**
 * Hono sub-app routes (paths relative to {@link patchDbPaths} `basePath` mount).
 * Matches wire URLs `{base}/patches/read` and `{base}/patches/write`.
 */
export function createPatchDbHttpHono(host: PatchDbSyncHost) {
  return new Hono()
    .post(
      PATCH_SUFFIX_READ,
      zValidator('json', patchDbReadBodySchema),
      async (c) => {
        const body = c.req.valid('json');
        const a: Assert = Assert.validation();
        a.record(body, 'Request body must be object');
        a.field(body, 'queries', 'queries required');
        a.array(body.queries, 'queries required');
        a.ok(body.queries.length > 0, 'queries must not be empty');
        a.all(body.queries, (q): asserts q is PatchesDbQuery =>
          assertQuery(a, q)
        );
        const queries = body.queries;
        const results = await host.read(queries);
        const stripped = results.map((r) => ({
          ...r,
          query: stripKnownPatchesFromQuery(r.query),
        }));
        applyNoCacheHeaders(c);
        return c.json(stripped, 200);
      }
    )
    .post(
      PATCH_SUFFIX_WRITE,
      zValidator('json', patchDbWriteBodySchema),
      async (c) => {
        const body = c.req.valid('json');
        const a: Assert = Assert.validation();
        a.record(body, 'Request body must be object');
        a.field(body, 'patches', 'patches required');
        a.array(body.patches, 'patches required');
        a.ok(body.patches.length > 0, 'patches must not be empty');
        a.all(body.patches, (p): asserts p is PatchInput =>
          assertPatchInput(a, p)
        );
        const patches = await host.write(body.patches);
        applyNoCacheHeaders(c);
        return c.json(patches, 200);
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
    basePath: string = DEFAULT_BASE_PATH
  ) {
    this.paths = patchDbPaths(basePath);
    this.honoApp = createPatchDbHttpHono(host);
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

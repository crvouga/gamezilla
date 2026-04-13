import { assert, Assert } from '@gamezilla/shared/assert';
import { Hono } from 'hono';
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

type ResolvedPaths = ReturnType<typeof patchDbPaths>;

/**
 * Hono sub-app routes (paths relative to {@link patchDbPaths} `basePath` mount).
 * Matches wire URLs `{base}/patches/read` and `{base}/patches/write`.
 */
export function createPatchDbHttpHono(host: PatchDbSyncHost): Hono {
  const app = new Hono();
  app.post(PATCH_SUFFIX_READ, async (c) => handleRead(c.req.raw, host));
  app.post(PATCH_SUFFIX_WRITE, async (c) => handleWrite(c.req.raw, host));
  return app;
}

async function handleWrite(req: Request, host: PatchDbSyncHost): Promise<Response> {
  assert.equals(req.method, 'POST', 'Invalid method');
  const body: unknown = await req.json();
  const a: Assert = Assert.validation();
  a.record(body, 'Request body must be object');
  a.field(body, 'patches', 'patches required');
  a.array(body.patches, 'patches required');
  a.ok(body.patches.length > 0, 'patches must not be empty');
  a.all(body.patches, (p): asserts p is PatchInput => assertPatchInput(a, p));
  const patches = await host.write(body.patches);
  return Response.json(patches, { headers: NO_CACHE_RESPONSE_HEADERS });
}

async function handleRead(req: Request, host: PatchDbSyncHost): Promise<Response> {
  assert.equals(req.method, 'POST', 'Invalid method');
  const body: unknown = await req.json();
  const a: Assert = Assert.validation();
  a.record(body, 'Request body must be object');
  a.field(body, 'queries', 'queries required');
  a.array(body.queries, 'queries required');
  a.ok(body.queries.length > 0, 'queries must not be empty');
  a.all(body.queries, (q): asserts q is PatchesDbQuery => assertQuery(a, q));
  const queries = body.queries;
  const results = await host.read(queries);
  const stripped = results.map((r) => ({
    ...r,
    query: stripKnownPatchesFromQuery(r.query),
  }));
  return Response.json(stripped, { headers: NO_CACHE_RESPONSE_HEADERS });
}

/**
 * HTTP adapter: Hono routes validate wire JSON and delegate to {@link PatchDbSyncHost}.
 * Mount with `parent.route(basePath, handler.honoApp)` or call {@link handleRequest}.
 */
export class PatchDbHttpRequestHandler {
  readonly honoApp: Hono;
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

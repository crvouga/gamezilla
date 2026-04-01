import { assert, Assert } from '@gamezilla/shared/assert';
import {
  type PatchInput,
  assertPatch,
  assertPatchInput,
  assertQuery,
  Patch,
  PatchesDbQuery,
} from '../interface';
import type { PatchDbSyncHost } from './interface';
import { DEFAULT_BASE_PATH, patchDbPaths } from './paths';

type ResolvedPaths = ReturnType<typeof patchDbPaths>;

/** HTTP adapter: validates wire JSON, delegates to {@link PatchDbSyncHost}. Web standard Request/Response only. */
export class PatchDbHttpRequestHandler {
  private readonly paths: ResolvedPaths;

  constructor(
    private readonly host: PatchDbSyncHost,
    basePath: string = DEFAULT_BASE_PATH
  ) {
    this.paths = patchDbPaths(basePath);
  }

  /** Returns a {@link Response} for patch-db routes, or `null` if this request does not match. */
  async handleRequest(req: Request): Promise<Response | null> {
    const url = new URL(req.url);

    if (url.pathname === this.paths.read && req.method === 'POST') {
      return this.handleRead(req, this.host);
    }

    if (url.pathname === this.paths.write && req.method === 'POST') {
      return this.handleWrite(req, this.host);
    }

    if (url.pathname === this.paths.events && req.method === 'GET') {
      return this.handleEvents(req, this.host);
    }

    return null;
  }

  private async handleEvents(
    req: Request,
    host: PatchDbSyncHost
  ): Promise<Response> {
    const url = new URL(req.url);
    assert.equals(url.pathname, this.paths.events, 'Invalid path');
    assert.equals(req.method, 'GET', 'Invalid method');
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const unsub = host.subscribe(() => {
          const data = JSON.stringify({ type: 'invalidated' });
          const encoded = encoder.encode(`data: ${data}\n\n`);
          controller.enqueue(encoded);
        });
        req.signal?.addEventListener('abort', () => {
          unsub();
          controller.close();
        });
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  private async handleWrite(
    req: Request,
    host: PatchDbSyncHost
  ): Promise<Response> {
    const url = new URL(req.url);
    assert.equals(url.pathname, this.paths.write, 'Invalid path');
    assert.equals(req.method, 'POST', 'Invalid method');
    const body: unknown = await req.json();
    const a: Assert = Assert.validation();
    a.record(body, 'Request body must be object');
    a.field(body, 'patches', 'patches required');
    a.array(body.patches, 'patches required');
    a.ok(body.patches.length > 0, 'patches must not be empty');
    a.all(body.patches, (p): asserts p is PatchInput => assertPatchInput(a, p));
    const patches = await host.write(body.patches);
    return Response.json(patches);
  }

  private async handleRead(
    req: Request,
    host: PatchDbSyncHost
  ): Promise<Response> {
    const url = new URL(req.url);
    assert.equals(url.pathname, this.paths.read, 'Invalid path');
    assert.equals(req.method, 'POST', 'Invalid method');
    const body: unknown = await req.json();
    const a: Assert = Assert.validation();
    a.record(body, 'Request body must be object');
    a.field(body, 'queries', 'queries required');
    a.array(body.queries, 'queries required');
    a.ok(body.queries.length > 0, 'queries must not be empty');
    a.all(body.queries, (q): asserts q is PatchesDbQuery => assertQuery(a, q));
    const queries = body.queries;
    const knownPatches = queries.map((q) => q.knownPatches).flat();
    a.all(knownPatches, (p): asserts p is Patch => assertPatch(a, p));
    const results = await host.read(queries);
    return Response.json(results);
  }
}

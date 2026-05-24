import {
  DEFAULT_BASE_PATH,
  PATCH_SUFFIX_READ,
  PATCH_SUFFIX_WRITE,
  patchDbPaths,
} from '../paths';
import type { PatchDbSyncHost } from '../interface';
import type { PatchDbHttpAuthOptions } from './auth';
import { createPatchDbHttpHono } from './create-hono-app';

type ResolvedPaths = ReturnType<typeof patchDbPaths>;

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

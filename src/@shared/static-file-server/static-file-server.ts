/**
 * Application-agnostic static file server.
 * Uses only web standards: Request, Response, Blob, URL.
 * File system access is injected via the getFile adapter.
 */

export const DEFAULT_MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.htm': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

export interface StaticFileServerOptions {
  /**
   * Resolves a request pathname to file contents.
   * Pathname is URL-decoded (e.g. "/" or "/index.html" or "/assets/foo.js").
   * Returns Blob if the file exists and is readable, null otherwise.
   * Adapter is responsible for path validation and security.
   */
  getFile: (pathname: string) => Blob | Promise<Blob | null> | null;
  /** File to serve for SPA fallback when path doesn't match (default: "/index.html") */
  indexPath?: string;
  /** MIME type overrides or extensions (merged with defaults) */
  mimeTypes?: Record<string, string>;
}

function getMimeType(
  pathname: string,
  mimeTypes: Record<string, string>
): string {
  const ext = pathname.includes('.')
    ? pathname.slice(pathname.lastIndexOf('.'))
    : '';
  return mimeTypes[ext] ?? 'application/octet-stream';
}

function isUnsafePath(pathname: string): boolean {
  return pathname.includes('..') || pathname.startsWith('//');
}

/**
 * Creates a fetch handler that serves static files.
 * Compatible with any runtime: Bun.serve, Node fetch, Deno.serve, Cloudflare Workers, etc.
 */
export function createStaticFileHandler(
  options: StaticFileServerOptions
): (request: Request) => Promise<Response> {
  const { getFile, indexPath = '/index.html', mimeTypes = {} } = options;
  const allMimeTypes = { ...DEFAULT_MIME_TYPES, ...mimeTypes };

  return async function staticFileHandler(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(url.pathname);

    if (isUnsafePath(pathname)) {
      return new Response('Forbidden', { status: 403 });
    }

    const requestPath = pathname === '/' ? '/index.html' : pathname;
    const blob = await Promise.resolve(getFile(requestPath));

    if (blob) {
      const contentType = getMimeType(requestPath, allMimeTypes);
      return new Response(blob, {
        headers: { 'Content-Type': contentType },
      });
    }

    // SPA fallback: serve index for client-side routing
    const indexBlob = await Promise.resolve(getFile(indexPath));
    if (indexBlob) {
      return new Response(indexBlob, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    return new Response('Not Found', { status: 404 });
  };
}

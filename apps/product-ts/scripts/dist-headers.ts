/**
 * Response headers for the product's built web assets: Cloudflare's
 * `_headers` file in production, and the release journeys' local server.
 */

/** COOP/COEP for SharedArrayBuffer (sqlite-wasm OPFS SAH pool). */
export const SQLITE_WEB_COOP = 'same-origin';
export const SQLITE_WEB_COEP = 'require-corp';

/**
 * Every HTML document is `no-store`, which keeps the page out of the
 * back/forward cache. A page the tab leaves is otherwise frozen there with
 * its database worker still holding the OPFS handles, and the next page's
 * open waits on them until the browser evicts it: past the open deadline,
 * so that page runs on a disposable in-memory database, and offline the
 * person's own spaces and drafts are gone from it (Release run 40628012072).
 * A restored page reloads anyway (`releaseOnPageHide`), so the cache bought
 * nothing. Built assets keep their normal caching.
 */
export const DOCUMENT_CACHE_CONTROL = 'no-store';

function isDocument(path: string): boolean {
  return path.endsWith('.html');
}

/**
 * The `_headers` file for a built `dist` whose files are `files` (paths
 * relative to it, `/`-separated). Every path is isolated and a document;
 * a top-level file or directory with no HTML in it detaches `Cache-Control`.
 */
export function distHeadersFile(files: readonly string[]): string {
  const directories = new Map<string, boolean>();
  const plainFiles: string[] = [];
  for (const file of files) {
    const slash = file.indexOf('/');
    if (slash === -1) {
      if (!isDocument(file) && file !== '_headers') plainFiles.push(file);
      continue;
    }
    const top = file.slice(0, slash);
    directories.set(top, (directories.get(top) ?? false) || isDocument(file));
  }
  const detached = [
    ...[...directories]
      .filter(([, hasDocument]) => !hasDocument)
      .map(([name]) => `/${name}/*`),
    ...plainFiles.map((name) => `/${name}`),
  ].sort();
  return [
    '/*',
    `\tCross-Origin-Opener-Policy: ${SQLITE_WEB_COOP}`,
    `\tCross-Origin-Embedder-Policy: ${SQLITE_WEB_COEP}`,
    `\tCache-Control: ${DOCUMENT_CACHE_CONTROL}`,
    '',
    '/sso-callback',
    '\tCross-Origin-Opener-Policy: same-origin-allow-popups',
    '',
    ...detached.flatMap((path) => [path, '\t! Cache-Control', '']),
  ].join('\n');
}

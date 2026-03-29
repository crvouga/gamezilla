/** Path suffixes after the configurable base path (client + server must agree). */
export const PATCH_SUFFIX_READ = '/patches/read';
export const PATCH_SUFFIX_WRITE = '/patches/write';
export const PATCH_SUFFIX_EVENTS = '/patches/events';

export const DEFAULT_BASE_PATH = '/patch-db';

function normalizeBasePath(basePath: string): string {
  const trimmed = basePath.replace(/\/+$/, '');
  return trimmed === '' ? DEFAULT_BASE_PATH : trimmed;
}

export function patchDbPaths(basePath: string = DEFAULT_BASE_PATH) {
  const base = normalizeBasePath(basePath);
  return {
    basePath: base,
    read: `${base}${PATCH_SUFFIX_READ}`,
    write: `${base}${PATCH_SUFFIX_WRITE}`,
    events: `${base}${PATCH_SUFFIX_EVENTS}`,
  };
}

/** Wire path prefix for patch-db HTTP transport (default). */
export const PATCHES_DB_BASE_URL = DEFAULT_BASE_PATH;
const defaultPaths = patchDbPaths();
export const PATCHES_READ = defaultPaths.read;
export const PATCHES_WRITE = defaultPaths.write;
export const PATCHES_EVENTS = defaultPaths.events;

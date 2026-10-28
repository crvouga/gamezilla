/**
 * Publishes one content-addressed transform cache entry: write a private tmp
 * file, then rename it onto the entry, so a concurrent reader never sees a
 * partial file.
 *
 * Windows refuses `rename` onto a file another process or worker thread is
 * replacing or still has open (`EPERM` / `EACCES` / `EBUSY`), where POSIX
 * replaces it atomically. The entry is keyed by its whole input, so whoever
 * holds it holds the same bytes: a busy destination means the cache is already
 * (being) filled, and the caller already has the code it would have cached.
 * The tmp file is removed and the transform result still returned.
 */

/** The `node:fs` calls one publish needs, injected so tests can refuse a rename. */
export type CacheFileFs = {
  readonly writeFileSync: (path: string, data: string) => void;
  readonly renameSync: (from: string, to: string) => void;
  readonly rmSync: (path: string, options: { readonly force: true }) => void;
};

const BUSY_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);

function isBusy(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    BUSY_CODES.has(String((error as { readonly code?: unknown }).code))
  );
}

/** Write `code` to `file` via the unique `tmp`; a busy destination is not an error. */
export function publishCacheFile(
  fs: CacheFileFs,
  file: string,
  tmp: string,
  code: string
): void {
  fs.writeFileSync(tmp, code);
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    if (!isBusy(error)) throw error;
  }
}

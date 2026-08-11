/** URL escape hatch: `?reset-db=1` triggers web OPFS recovery. */
export const RESET_DB_QUERY_PARAM = 'reset-db';

/**
 * Static wipe document (no Expo). SW navigateFallback denylists `/sql-workers/`.
 * Prefer this over `/?opfs-wipe=1` document.write so an already-loaded Expo
 * page fully unloads and Dedicated Workers can terminate before OPFS wipe.
 */
export const DEFAULT_OPFS_WIPE_PAGE_URL = '/sql-workers/opfs-wipe.html';

/** sessionStorage flag: this tab initiated recovery (do not park on prepare-wipe). */
export const OPFS_WIPE_INITIATOR_SESSION_KEY = 'sql-client-opfs-wipe-initiator';

/**
 * Same-origin path for post-wipe navigation. Rejects protocol-relative /
 * absolute URLs and anything that looks like a wipe/park infrastructure page.
 */
export function sanitizeWebOpfsReturnTo(returnTo: string | undefined): string {
  if (
    returnTo === undefined ||
    returnTo.length === 0 ||
    !returnTo.startsWith('/') ||
    returnTo.startsWith('//') ||
    returnTo.includes('reset-opfs') ||
    returnTo.includes('opfs-wipe') ||
    returnTo.includes('opfs-wiping')
  ) {
    return '/';
  }
  return returnTo;
}

export type BuildWebOpfsWipePageUrlOptions = {
  readonly returnTo?: string;
  /** Peer tabs park here until `wipe-done` (no OPFS mutation). */
  readonly parked?: boolean;
};

/**
 * Build `/sql-workers/opfs-wipe.html?opfs-wipe=1&return=…` (or `opfs-wipe=park`).
 * `index.html` still bootstraps wipe for `/?opfs-wipe=*` as a fallback.
 */
export function buildWebOpfsWipePageUrl(
  opts: BuildWebOpfsWipePageUrlOptions = {}
): string {
  const params = new URLSearchParams();
  params.set('opfs-wipe', opts.parked === true ? 'park' : '1');
  params.set('return', sanitizeWebOpfsReturnTo(opts.returnTo));
  return `${DEFAULT_OPFS_WIPE_PAGE_URL}?${params.toString()}`;
}

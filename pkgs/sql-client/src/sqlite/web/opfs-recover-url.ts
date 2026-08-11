/** URL escape hatch: `?reset-db=1` triggers web OPFS recovery. */
export const RESET_DB_QUERY_PARAM = 'reset-db';

/**
 * Same-origin path for post-wipe navigation. Rejects protocol-relative /
 * absolute URLs and anything that looks like a legacy reset park page.
 */
export function sanitizeWebOpfsReturnTo(returnTo: string | undefined): string {
  if (
    returnTo === undefined ||
    returnTo.length === 0 ||
    !returnTo.startsWith('/') ||
    returnTo.startsWith('//') ||
    returnTo.includes('reset-opfs')
  ) {
    return '/';
  }
  return returnTo;
}

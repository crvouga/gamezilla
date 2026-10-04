/**
 * The spec reports screen's routes (a flat sibling of the app and the
 * harness): `/reports` lists every published commit, `/reports/<sha>` shows
 * one. Pure, so the entry can route without loading the screen.
 */

export const REPORTS_PATH = '/reports';

const SHA = /^[0-9a-f]{40}$/;

export function isReportsPath(pathname: string): boolean {
  return pathname === REPORTS_PATH || pathname.startsWith(`${REPORTS_PATH}/`);
}

/** The commit a reports path names, or null for the list (or anything else). */
export function reportsPathSha(pathname: string): string | null {
  const rest = pathname.slice(`${REPORTS_PATH}/`.length).replace(/\/+$/, '');
  return isReportsPath(pathname) && SHA.test(rest) ? rest : null;
}

export function reportsPathFor(sha: string | null): string {
  return sha === null ? REPORTS_PATH : `${REPORTS_PATH}/${sha}`;
}

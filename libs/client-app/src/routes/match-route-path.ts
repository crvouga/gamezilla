/**
 * Pure matcher over `APP_ROUTE_TABLE` patterns (`:param` segments, exact
 * otherwise). Used by tests to prove every linking-config path resolves to a
 * real route rather than the catch-all; the runtime matcher is
 * `@solidjs/router`.
 */

import { APP_ROUTE_TABLE, type AppRouteEntry } from './route-table';

function splitSegments(path: string): string[] {
  return path.split('/').filter((segment) => segment.length > 0);
}

export function routePatternMatches(
  pattern: string,
  pathname: string
): boolean {
  const expected = splitSegments(pattern);
  const actual = splitSegments(pathname);
  if (expected.length !== actual.length) return false;
  return expected.every((segment, index) => {
    const value = actual[index];
    if (value === undefined) return false;
    return segment.startsWith(':') ? value.length > 0 : segment === value;
  });
}

/** First table entry whose pattern matches `pathname`, or `null` (→ not found). */
export function matchAppRoute(pathname: string): AppRouteEntry | null {
  return (
    APP_ROUTE_TABLE.find((entry) =>
      routePatternMatches(entry.path, pathname)
    ) ?? null
  );
}

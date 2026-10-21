/** Absolute href for a `fetch` input; relative strings are returned as-is. */
export function requestHref(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function tryParseUrl(href: string): URL | null {
  try {
    return new URL(href);
  } catch {
    return null;
  }
}

export function sameOrigin(href: string, origin: string): boolean {
  const url = tryParseUrl(href);
  return url !== null && url.origin === origin;
}

export function hrefEquals(left: string, right: string): boolean {
  const a = tryParseUrl(left);
  const b = tryParseUrl(right);
  if (a !== null && b !== null) return a.href === b.href;
  return left === right;
}

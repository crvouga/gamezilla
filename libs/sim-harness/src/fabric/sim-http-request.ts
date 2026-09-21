/** Method / path extraction shared by the balancer and console log mirrors. */

export function requestMethod(
  input: RequestInfo | URL,
  init?: RequestInit
): string {
  if (init?.method != null) return init.method.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

/** Absolute (or raw) URL of a request, whatever shape the caller passed. */
export function requestHref(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function requestPath(input: RequestInfo | URL): string {
  const href = requestHref(input);
  try {
    return new URL(href).pathname;
  } catch {
    return href;
  }
}

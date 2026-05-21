/**
 * Build CORS headers that work with both `credentials: 'omit'` and `credentials: 'include'`.
 * Better Auth client uses `credentials: 'include'` by default, which forbids
 * `Access-Control-Allow-Origin: *`. We must echo the request's `Origin` and add
 * `Access-Control-Allow-Credentials: true` when `Origin` is present.
 */
function buildBetterAuthCorsHeaders(origin: string | null): {
  acao: string;
  acac: 'true' | null;
} {
  if (origin !== null && origin.length > 0) {
    return { acao: origin, acac: 'true' };
  }
  return { acao: '*', acac: null };
}

/**
 * OPTIONS preflight for Better Auth must succeed before `app.fetch` / Hono run.
 * Hono’s router can skip chained `use()` middleware for some OPTIONS matches, so the
 * Worker entry (`api.ts`) calls this **before** delegating to the Hono app.
 */
export function tryBetterAuthOptionsResponse(
  request: Request
): Response | null {
  if (request.method !== 'OPTIONS') return null;
  const pathname = new URL(request.url).pathname;
  if (pathname !== '/api/auth' && !pathname.startsWith('/api/auth/'))
    return null;

  const acrhRaw = request.headers.get('Access-Control-Request-Headers');
  const allowHeaders =
    typeof acrhRaw === 'string' && acrhRaw.trim().length > 0
      ? acrhRaw.trim()
      : 'authorization, cache-control, content-type, pragma, x-anon-id, accept';

  const origin = request.headers.get('Origin');
  const { acao, acac } = buildBetterAuthCorsHeaders(origin);

  const h = new Headers();
  h.set('Access-Control-Allow-Origin', acao);
  if (acac !== null) h.set('Access-Control-Allow-Credentials', acac);
  h.set(
    'Access-Control-Allow-Methods',
    'GET, HEAD, PUT, POST, PATCH, DELETE, OPTIONS'
  );
  h.set('Access-Control-Allow-Headers', allowHeaders);
  h.set('Access-Control-Expose-Headers', 'set-auth-token');
  h.set('Access-Control-Max-Age', '86400');
  h.set('Vary', 'Origin, Access-Control-Request-Headers');
  return new Response(null, { status: 204, headers: h });
}

/**
 * Apply Better Auth–compatible CORS headers to a non-OPTIONS response (POST/GET to
 * `/api/auth/*`). Mirrors {@link tryBetterAuthOptionsResponse}: echoes Origin and
 * adds `Allow-Credentials: true` so `credentials: 'include'` clients accept the body.
 */
export function withBetterAuthBrowserCorsForRequest(
  request: Request,
  res: Response
): Response {
  const origin = request.headers.get('Origin');
  const { acao, acac } = buildBetterAuthCorsHeaders(origin);
  const headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', acao);
  if (acac !== null) headers.set('Access-Control-Allow-Credentials', acac);
  if (!headers.has('Access-Control-Expose-Headers')) {
    headers.set('Access-Control-Expose-Headers', 'set-auth-token');
  }
  headers.set('Vary', 'Origin');
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

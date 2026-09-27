import type { MiddlewareHandler } from 'hono';

/**
 * CORS for browser / web clients calling the API.
 *
 * Better Auth’s web client always sends `credentials: 'include'` (OAuth state
 * cookies on the API origin). Browsers reject credentialed responses when
 * `Access-Control-Allow-Origin` is `*`, which surfaces as "Failed to fetch".
 * Reflect the request Origin and allow credentials so BA (and Bearer
 * `set-auth-token`) work cross-origin from the web app.
 *
 * Do **not** use `hono/cors` here: it reads `c.res` before `next()` and calls
 * `c.header()` after. On some runtimes, `Response.body` is undefined, so Hono’s
 * `c.res` setter / finalized `c.header()` recreate the response as
 * `new Response(undefined, …)` — status 200 with an empty body
 * (`auth/anon/ensure empty/non-object body`).
 *
 * Headers go onto the final response **after** `next()`, in place. Headers
 * prepared with `c.header()` before `next()` are dropped when a handler
 * returns a raw `Response` (the auth service's `handler.fetch`): production
 * `POST /api/auth/session` then carried no `Access-Control-Allow-Origin`, and
 * every browser sign-in silently failed.
 */
const EXPOSE_HEADERS = 'set-auth-token, traceparent';
const ALLOW_METHODS = 'GET,HEAD,PUT,POST,DELETE,PATCH';

function writeCorsHeaders(headers: Headers, origin: string | undefined): void {
  if (origin !== undefined && origin.length > 0) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.append('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Expose-Headers', EXPOSE_HEADERS);
}

export const apiCors: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header('origin');

  if (c.req.method === 'OPTIONS') {
    const headers = new Headers();
    writeCorsHeaders(headers, origin);
    headers.set('Access-Control-Allow-Methods', ALLOW_METHODS);
    const requestHeaders = c.req.header('Access-Control-Request-Headers');
    if (requestHeaders != null && requestHeaders.length > 0) {
      headers.set('Access-Control-Allow-Headers', requestHeaders);
      headers.append('Vary', 'Access-Control-Request-Headers');
    }
    return new Response(null, { status: 204, headers });
  }

  await next();

  if (c.res.status === 101) return;
  try {
    writeCorsHeaders(c.res.headers, origin);
  } catch {
    // Immutable headers (a proxied `fetch()` response): copy onto a new one.
    const res = c.res;
    const headers = new Headers(res.headers);
    writeCorsHeaders(headers, origin);
    c.res = undefined;
    c.res = new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }
  return;
};

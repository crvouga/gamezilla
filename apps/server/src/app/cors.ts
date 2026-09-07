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
 * (`auth/anon/ensure empty/non-object body`). Set headers only via `c.header()`
 * before finalize, and mutate `c.res.headers` in place afterward.
 */
const EXPOSE_HEADERS = 'set-auth-token, traceparent';
const ALLOW_METHODS = 'GET,HEAD,PUT,POST,DELETE,PATCH';

export const apiCors: MiddlewareHandler = async (c, next) => {
  const origin = c.req.header('origin');
  if (origin != null && origin.length > 0) {
    c.header('Access-Control-Allow-Origin', origin);
  }
  c.header('Access-Control-Allow-Credentials', 'true');
  c.header('Access-Control-Expose-Headers', EXPOSE_HEADERS);

  if (c.req.method === 'OPTIONS') {
    c.header('Vary', 'Origin');
    c.header('Access-Control-Allow-Methods', ALLOW_METHODS);
    const requestHeaders = c.req.header('Access-Control-Request-Headers');
    if (requestHeaders != null && requestHeaders.length > 0) {
      c.header('Access-Control-Allow-Headers', requestHeaders);
      c.header('Vary', 'Access-Control-Request-Headers', { append: true });
    }
    return c.body(null, 204);
  }

  await next();

  if (origin != null && origin.length > 0) {
    try {
      c.res.headers.append('Vary', 'Origin');
    } catch {
      // Immutable responses (e.g. 101) — skip.
    }
  }
  return;
};

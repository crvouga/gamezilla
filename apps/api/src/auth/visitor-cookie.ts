import { getCookie, setCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';

const VISITOR_COOKIE_NAME = 'visitorId';
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/**
 * Parses the visitorId from a raw `Request`'s Cookie header.
 * Falls back to a fresh UUID when the cookie is absent — the Hono
 * middleware will set the cookie on the response so future requests
 * carry the same id.
 */
export function parseVisitorIdFromCookies(req: Request): string {
  const header = req.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.split('=');
    if (name?.trim() === VISITOR_COOKIE_NAME) {
      const value = rest.join('=').trim();
      if (value.length > 0) return value;
    }
  }
  return crypto.randomUUID();
}

/**
 * Hono middleware that ensures every request has a `visitorId`.
 * Reads it from the cookie; if absent, generates a UUID and sets the cookie.
 * The value is stored on the Hono context via `c.set('visitorId', id)`.
 */
export const visitorCookieMiddleware: MiddlewareHandler<{
  Variables: { visitorId: string };
}> = async (c, next) => {
  let visitorId = getCookie(c, VISITOR_COOKIE_NAME);

  if (!visitorId || visitorId.trim().length === 0) {
    visitorId = crypto.randomUUID();
    setCookie(c, VISITOR_COOKIE_NAME, visitorId, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: ONE_YEAR_SECONDS,
      secure: c.req.url.startsWith('https'),
    });
  }

  c.set('visitorId', visitorId);
  await next();
};

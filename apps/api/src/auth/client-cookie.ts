import { getCookie, setCookie } from 'hono/cookie';
import type { MiddlewareHandler } from 'hono';

const CLIENT_COOKIE_NAME = 'clientId';
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/**
 * Parses the clientId from a raw `Request`'s Cookie header.
 * Falls back to a fresh UUID when the cookie is absent — the Hono
 * middleware will set the cookie on the response so future requests
 * carry the same id.
 */
export function parseClientIdFromCookies(req: Request): string {
  const header = req.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.split('=');
    if (name?.trim() === CLIENT_COOKIE_NAME) {
      const value = rest.join('=').trim();
      if (value.length > 0) return value;
    }
  }
  return crypto.randomUUID();
}

/**
 * Hono middleware that ensures every request has a `clientId`.
 * Reads it from the cookie; if absent, generates a UUID and sets the cookie.
 * The value is stored on the Hono context via `c.set('clientId', id)`.
 */
export const clientCookieMiddleware: MiddlewareHandler<{
  Variables: { clientId: string };
}> = async (c, next) => {
  let clientId = getCookie(c, CLIENT_COOKIE_NAME);

  if (!clientId || clientId.trim().length === 0) {
    clientId = crypto.randomUUID();
    setCookie(c, CLIENT_COOKIE_NAME, clientId, {
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: ONE_YEAR_SECONDS,
      secure: c.req.url.startsWith('https'),
    });
  }

  c.set('clientId', clientId);
  await next();
};

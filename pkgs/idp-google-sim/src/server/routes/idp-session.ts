/** The browser session cookie: read it, or hand out a fresh one. */

import type { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';

import { IDP_SESSION_COOKIE } from '../../shared/paths';
import type { IdpBrowserSession } from '../../shared/types';
import type { IdpStore } from '../idp-state';

export function attachSession(c: Context, session: IdpBrowserSession): void {
  setCookie(c, IDP_SESSION_COOKIE, session.id, {
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  });
}

/** The browser behind the cookie, created on first sight, and re-attached. */
export async function sessionOf(
  c: Context,
  store: IdpStore
): Promise<IdpBrowserSession> {
  const session = await store.ensureSession(
    getCookie(c, IDP_SESSION_COOKIE) ?? null
  );
  attachSession(c, session);
  return session;
}

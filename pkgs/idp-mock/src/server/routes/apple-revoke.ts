/**
 * `POST /auth/revoke` on an Apple-flavored provider.
 *
 * Unlike Google's unauthenticated `/revoke`, Apple's needs the same client
 * authentication as the token endpoint. Revoking a refresh token does more
 * than kill the token: it removes the app's authorization for the account,
 * so the next sign-in is a *first* authorization again — the name and
 * address come back in the `user` blob, and the email choice is re-asked.
 */

import type { Context } from 'hono';

import type { IdpCtx } from '../idp-context';
import { authenticateClient } from './token';

async function readForm(c: Context): Promise<Record<string, string>> {
  const form: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(await c.req.text())) {
    form[key] = value;
  }
  return form;
}

export async function handleAppleRevoke(
  c: Context,
  ctx: IdpCtx
): Promise<Response> {
  const form = await readForm(c);
  if ((await authenticateClient(ctx.store, form)) !== null) {
    return c.json({ error: 'invalid_client' }, 400);
  }
  const token = form['token'] ?? '';
  const clientId = form['client_id'] ?? '';
  const refresh = await ctx.store.refreshToken(token);
  if (refresh !== null && refresh.clientId === clientId) {
    await ctx.store.tx(async (store) => {
      await store.revokeGrant(refresh.sub, refresh.clientId);
    });
    return c.body(null, 200);
  }
  const access = await ctx.store.accessToken(token);
  if (access !== null && access.clientId === clientId) {
    await ctx.store.deleteAccessToken(token);
  }
  // Apple answers 200 for unknown tokens too: revocation is idempotent.
  return c.body(null, 200);
}

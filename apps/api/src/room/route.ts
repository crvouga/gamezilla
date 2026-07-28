import { ANON_ID_HEADER, resolveAccountIdFromBearer } from '@libs/auth/server';
import { isUuid } from '@pkgs/uuid';
import type { Context } from 'hono';
import { Hono } from 'hono';

import type { ApiHonoEnv } from '../app/api-hono-types';

/**
 * Header the room Durable Object adapter reads to learn the actor id for an
 * accepted WebSocket. Must match the DO adapter's `identityHeader` (default
 * `x-actor-id`; see `createDurableObjectAdapter` in `@pkgs/room`).
 */
export const ROOM_ACTOR_ID_HEADER = 'x-actor-id';

/**
 * Header the room Durable Object adapter reads for the per-tab client id.
 * Must match the DO adapter's `clientIdHeader` (default `x-actor-client-id`).
 */
export const ROOM_ACTOR_CLIENT_ID_HEADER = 'x-actor-client-id';

/**
 * Generic Room WebSocket-upgrade gateway. Open to anyone — never blocks on
 * auth. Resolves the best available actor id from the request and forwards
 * the upgrade to the `ROOM` DO; the DO validates `module` and runs game
 * logic from there.
 *
 * Actor id is the Meet-style member id: signed-in account when the bearer +
 * device binding resolve, otherwise the install device id (anon device *is*
 * the user). Device binding is still verified when signed in.
 *
 * When a bearer is offered but fails to resolve, fall back to the install id
 * so the socket can still sync. Clients refresh `token` on reconnect
 * (URL factory + getFreshToken) to restore account identity for host checks.
 *
 * Fallback: a fresh per-connection UUID when no anonId is available.
 *
 * - Path: `/room` (always WebSocket).
 * - Query `topic`: non-empty string keying the DO instance via `idFromName`.
 * - Query `module`: forwarded to the DO unchanged (validated there).
 * - Query `clientId`: per-tab id forwarded as {@link ROOM_ACTOR_CLIENT_ID_HEADER}.
 * - Query `token` / `anonId` and `Authorization` / `x-anon-id` headers:
 *   consumed by actor-id resolution; passed through otherwise.
 */
export function createRoomApp() {
  return new Hono<ApiHonoEnv>().get('/room', async (c) => {
    const topic =
      new URL(c.req.raw.url).searchParams.get('topic')?.trim() ?? '';
    if (topic.length === 0) {
      return c.json({ error: 'missing topic query parameter' }, 400);
    }

    const ns = c.env.ROOM;
    if (ns === undefined || ns === null) {
      return c.json({ error: 'ROOM binding not configured' }, 503);
    }

    const actorId = await resolveRoomActorId(c);
    const clientId = parseClientId(c.req.raw);
    const stub = ns.get(ns.idFromName(topic));
    const headers = new Headers(c.req.raw.headers);
    headers.set(ROOM_ACTOR_ID_HEADER, actorId);
    if (clientId !== null) {
      headers.set(ROOM_ACTOR_CLIENT_ID_HEADER, clientId);
    }

    // Use `new Request(originalRequest, init)` (not `new Request(url, init)`)
    // so the Workers runtime preserves the WebSocket upgrade context when
    // forwarding to the DO. The URL+init form treats `Upgrade`/`Connection`
    // as forbidden fetch headers and strips them, causing the DO to reply
    // 426 ("Expected WebSocket Upgrade").
    return stub.fetch(new Request(c.req.raw, { headers }));
  });
}

async function resolveRoomActorId(c: Context<ApiHonoEnv>): Promise<string> {
  const request = c.req.raw;
  const bearer = parseBearer(request);
  const anonId = parseAnonId(request);

  if (bearer !== null && anonId !== null && isUuid(anonId)) {
    const accountId = await tryResolveAccount(c, bearer, anonId);
    if (accountId !== null) return accountId;
    // Stale bearer: fall back to install id so the socket can still sync.
    return anonId;
  }
  if (anonId !== null) return anonId;
  return crypto.randomUUID();
}

async function tryResolveAccount(
  c: Context<ApiHonoEnv>,
  bearerToken: string,
  deviceId: string
): Promise<string | null> {
  try {
    return await resolveAccountIdFromBearer({
      sql: c.get('sqlClient'),
      authServer: c.get('authServer'),
      bearerToken,
      deviceId,
    });
  } catch {
    // Any auth resolution failure (invalid token, DB hiccup, etc.) falls back
    // to anon — never blocks the upgrade.
    return null;
  }
}

/**
 * Browsers cannot set `Authorization` on a `WebSocket`, so the bearer is also
 * accepted via the `?token=` query param.
 */
function parseBearer(request: Request): string | null {
  const url = new URL(request.url);
  const q = url.searchParams.get('token')?.trim() ?? '';
  if (q.length > 0) return q;
  const header = request.headers.get('Authorization');
  if (header === null || !header.startsWith('Bearer ')) return null;
  const t = header.slice('Bearer '.length).trim();
  return t.length > 0 ? t : null;
}

function parseAnonId(request: Request): string | null {
  const url = new URL(request.url);
  const q = url.searchParams.get('anonId')?.trim() ?? '';
  if (q.length > 0) return q;
  const h = request.headers.get(ANON_ID_HEADER)?.trim() ?? '';
  return h.length > 0 ? h : null;
}

function parseClientId(request: Request): string | null {
  const url = new URL(request.url);
  const q = url.searchParams.get('clientId')?.trim() ?? '';
  if (q.length > 0 && isUuid(q)) return q;
  const h = request.headers.get(ROOM_ACTOR_CLIENT_ID_HEADER)?.trim() ?? '';
  return h.length > 0 && isUuid(h) ? h : null;
}

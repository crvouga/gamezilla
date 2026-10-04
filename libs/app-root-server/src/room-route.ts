import { requireRequestStore } from '@libs/app-root-shared/request-scope';
import type { ApiHonoEnv } from '@libs/auth-shared/api-hono-env';
import { appAuth } from '@libs/auth-shared/auth-context';
import { ANON_ID_HEADER } from '@libs/auth-shared/session-middleware';
import type { ComposedFeatureServers } from '@libs/feature-shared/compose-server';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { injectRequestHeaders } from '@pkgs/observability-root-server/worker-worker';
import { isUuid } from '@pkgs/uuid-shared/uuid';
import type { Context } from 'hono';
import { Hono } from 'hono';

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
 * Header carrying the grants the gateway admitted the connection with
 * (comma-separated permission keys). Must match the room host's grants
 * header (default `x-actor-grants`; `ROOM_GRANTS_HEADER` in `@pkgs/room`).
 * Only the gateway sets it: a client-supplied value is always replaced.
 */
export const ROOM_ACTOR_GRANTS_HEADER = 'x-actor-grants';

/** Who is connecting, as resolved from the upgrade request. */
type RoomActor = {
  /** Bound user identity, resolved by the same auth port as sync mutations. */
  readonly memberId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
};

/**
 * Generic room-server WebSocket-upgrade gateway. Open to anyone — never blocks on
 * auth. Resolves the best available actor id from the request and forwards
 * the upgrade to the `ROOM` DO; the DO validates `module` and runs game
 * logic from there.
 *
 * Actor id is the bound user for both guests and signed-in people, resolved
 * exactly as it is for sync mutations. A device id is not a user id.
 *
 * A stale bearer can still resolve a bound guest through the auth port.
 * Unresolved devices retain their install identity and need permission to
 * enter the room. Clients refresh `token` on reconnect.
 *
 * Fallback: a fresh per-connection UUID when no anonId is available.
 *
 * Grants: the composed features decide, from the stored rows, what the actor
 * may do in the topic's room (for a space: the game choice, host only —
 * `roomGrants`), and the gateway forwards them in
 * {@link ROOM_ACTOR_GRANTS_HEADER}, replacing anything the client sent under
 * that name. A failed decision admits the connection with no grants.
 *
 * - Path: `/room` (always WebSocket).
 * - Query `topic`: non-empty string keying the DO instance via `idFromName`.
 * - Query `module`: forwarded to the DO unchanged (validated there).
 * - Query `clientId`: per-tab id forwarded as {@link ROOM_ACTOR_CLIENT_ID_HEADER}.
 * - Query `token` / `anonId` and `Authorization` / `x-anon-id` headers:
 *   consumed by actor-id resolution; passed through otherwise.
 */
export function createRoomApp(
  roomGrants: ComposedFeatureServers['roomGrants']
) {
  return new Hono<ApiHonoEnv>().get('/room', async (c) => {
    const topic =
      new URL(c.req.raw.url).searchParams.get('topic')?.trim() ?? '';
    if (topic.length === 0) {
      return c.json({ error: 'missing topic query parameter' }, 400);
    }

    // Hosts that serve the app without Worker bindings have no `c.env`.
    const ns = (c.env as ApiHonoEnv['Bindings'] | undefined)?.ROOM;
    if (ns === undefined || ns === null) {
      return c.json({ error: 'ROOM binding not configured' }, 503);
    }

    const actor = await resolveRoomActor(c);
    const grants = await decideRoomGrants(roomGrants, { topic, actor });
    if (
      topic.startsWith('space:') &&
      !grants.includes(PERMISSION.spacesLeave)
    ) {
      return c.json({ error: 'not in the space' }, 403);
    }
    const clientId = parseClientId(c.req.raw);
    const stub = ns.get(ns.idFromName(topic));
    const headers = new Headers(c.req.raw.headers);
    injectRequestHeaders(headers);
    headers.set(ROOM_ACTOR_ID_HEADER, actor.memberId);
    headers.delete(ROOM_ACTOR_GRANTS_HEADER);
    headers.set(ROOM_ACTOR_GRANTS_HEADER, grants.join(','));
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

async function resolveRoomActor(c: Context<ApiHonoEnv>): Promise<RoomActor> {
  const request = c.req.raw;
  const bearer = parseBearer(request);
  const anonId = parseAnonId(request);

  if (anonId !== null && isUuid(anonId)) {
    const accountId = await tryResolveAccount(request, bearer, anonId);
    if (accountId !== null) {
      return { memberId: accountId, deviceId: anonId, accountId };
    }
  }
  const deviceId = anonId ?? requireRequestStore().createId();
  return { memberId: deviceId, deviceId, accountId: null };
}

/**
 * What the actor may do in the topic's room, decided now from the stored
 * rows. Never blocks the upgrade: a failed decision is no grants.
 */
async function decideRoomGrants(
  roomGrants: ComposedFeatureServers['roomGrants'],
  args: { readonly topic: string; readonly actor: RoomActor }
): Promise<readonly string[]> {
  const { sqlClient, clock } = requireRequestStore();
  try {
    return await roomGrants({
      db: sqlClient,
      topic: args.topic,
      actor: args.actor,
      nowMs: clock.now(),
    });
  } catch {
    return [];
  }
}

async function tryResolveAccount(
  request: Request,
  bearerToken: string | null,
  deviceId: string
): Promise<string | null> {
  try {
    const { sqlClient, sessionAuth } = requireRequestStore();
    const headers = new Headers({ [ANON_ID_HEADER]: deviceId });
    if (bearerToken !== null)
      headers.set('Authorization', `Bearer ${bearerToken}`);
    const claims = await sessionAuth.resolveAuthContext(
      sqlClient,
      new Request(request.url, { headers })
    );
    return appAuth(claims)?.accountId ?? null;
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

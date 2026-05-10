import { assertDeviceId } from '@gamezilla/auth/shared/device-id';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@gamezilla/spaces/shared/space-entities';
import { spaceGuestMembershipEntityId } from '@gamezilla/spaces/shared/membership-key';
import type { Entity, PatchDb } from '@gamezilla/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@gamezilla/patch-db/interface';

import { resolveAccountIdFromBearer } from '@gamezilla/auth/server/bearer-resolve';
import type { HttpBearerAuthPorts } from '@gamezilla/auth/server/ports';
import { ANON_ID_HEADER } from '@gamezilla/auth/server/session-middleware';

const ROOM_TOPIC_PREFIX = 'space:' as const;

export const ACTOR_ID_HEADER = 'x-gamezilla-actor-id';

function jsonResponse(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseBearerFromUrlOrHeader(request: Request): string | null {
  const url = new URL(request.url);
  const rawToken = url.searchParams.get('token');
  const q = typeof rawToken === 'string' ? rawToken.trim() : '';
  if (q.length > 0) return q;
  const header = request.headers.get('Authorization');
  if (header === null || !header.startsWith('Bearer ')) return null;
  const t = header.slice('Bearer '.length).trim();
  return t.length > 0 ? t : null;
}

function parseAnonIdFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const q = url.searchParams.get('anonId')?.trim() ?? '';
  if (q.length > 0) return q;
  const h = request.headers.get(ANON_ID_HEADER)?.trim() ?? '';
  return h.length > 0 ? h : null;
}

function parseSpaceIdFromTopic(topic: string): string | null {
  if (!topic.startsWith(ROOM_TOPIC_PREFIX)) return null;
  const id = topic.slice(ROOM_TOPIC_PREFIX.length);
  return id.length > 0 ? id : null;
}

function spaceEntityIsLive(
  attrs: Record<string, unknown> | undefined
): boolean {
  const ended = attrs?.[SpaceAttr.endedAt.key];
  return ended === undefined || ended === null;
}

async function readSpaceEntity(
  db: PatchDb,
  spaceId: string
): Promise<Entity | null> {
  const [spaceRes] = await db.read(
    [
      {
        entityType: SPACE_ENTITY_TYPE,
        entityId: spaceId,
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );
  return spaceRes?.entities[0] ?? null;
}

function readHostId(space: Entity): string {
  const raw = space.attributes[SpaceAttr.hostId.key];
  return typeof raw === 'string' ? raw : '';
}

async function readGuestMembershipRow(
  db: PatchDb,
  myId: string,
  spaceId: string
): Promise<Entity | null> {
  const entityId = spaceGuestMembershipEntityId(myId, spaceId);
  const [memRes] = await db.read(
    [
      {
        entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
        entityId,
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );
  return memRes?.entities[0] ?? null;
}

function guestMembershipDenied(
  mem: Entity | null,
  spaceId: string
): Response | null {
  if (!mem) {
    return jsonResponse(403, 'not a member of this space');
  }
  const leftAt = mem.attributes[SpaceMembershipAttr.leftAt.key];
  if (leftAt !== undefined && leftAt !== null) {
    return jsonResponse(403, 'membership inactive');
  }
  const memSpaceId = mem.attributes[SpaceMembershipAttr.spaceId.key];
  if (typeof memSpaceId !== 'string' || memSpaceId !== spaceId) {
    return jsonResponse(403, 'not a member of this space');
  }
  return null;
}

export type SpaceDoAuthDeps = HttpBearerAuthPorts;

async function resolveActorIdForSpaceWebSocket(
  db: PatchDb,
  request: Request,
  deps: SpaceDoAuthDeps
): Promise<{ myId: string } | Response> {
  const bearer = parseBearerFromUrlOrHeader(request);
  if (bearer !== null) {
    const installId = parseAnonIdFromRequest(request);
    if (installId === null || installId.length === 0) {
      return jsonResponse(
        401,
        'missing anonId (install id) for authenticated websocket'
      );
    }
    assertDeviceId(installId);
    const myId = await resolveAccountIdFromBearer({
      db,
      bearerAuth: deps,
      bearerToken: bearer,
      deviceId: installId,
    });
    if (myId === null) {
      return jsonResponse(401, 'invalid or expired session');
    }
    return { myId };
  }

  const anon = parseAnonIdFromRequest(request);
  if (anon === null || anon.length === 0) {
    return jsonResponse(401, 'missing session token or anon id');
  }
  assertDeviceId(anon);
  return { myId: anon };
}

/**
 * Validates the WebSocket upgrade for `/space/ws` before forwarding to the
 * Space Durable Object: session JWT (+ install id) or anon id, topic shape, and
 * that the caller is the space host or an active guest member.
 */
export async function authorizeSpaceDoWebSocket(
  db: PatchDb,
  request: Request,
  topic: string,
  deps: SpaceDoAuthDeps
): Promise<{ myId: string } | Response> {
  const actor = await resolveActorIdForSpaceWebSocket(db, request, deps);
  if (actor instanceof Response) {
    return actor;
  }
  const { myId } = actor;

  const spaceId = parseSpaceIdFromTopic(topic);
  if (spaceId === null) {
    return jsonResponse(400, 'invalid topic');
  }

  const space = await readSpaceEntity(db, spaceId);
  if (!space || !spaceEntityIsLive(space.attributes)) {
    return jsonResponse(403, 'space not found or ended');
  }

  if (readHostId(space) === myId) {
    return { myId };
  }

  const denied = guestMembershipDenied(
    await readGuestMembershipRow(db, myId, spaceId),
    spaceId
  );
  return denied ?? { myId };
}

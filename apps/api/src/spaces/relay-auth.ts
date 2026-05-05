import { AccountSessionAttr } from '@gamezilla/domain/auth';
import { assertDeviceId } from '@gamezilla/domain/auth/device-id';
import { spaceGuestMembershipEntityId } from '@gamezilla/domain/spaces/membership-key';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { assert } from '@gamezilla/lib/assert';
import type { Entity, PatchDb } from '@gamezilla/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@gamezilla/patch-db/interface';

import { ANON_ID_HEADER } from '../auth/session-middleware';
import { readAccountSessionsByToken } from '../auth/account-session-by-token';

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

async function resolveMyIdFromBearer(
  db: PatchDb,
  bearer: string
): Promise<string | null> {
  const entities = await readAccountSessionsByToken(db, bearer);
  const now = Date.now();

  for (const entity of entities) {
    const deviceId = entity.attributes[AccountSessionAttr.deviceId];
    const accountId = entity.attributes[AccountSessionAttr.accountId];
    const expiresAtRaw = entity.attributes[AccountSessionAttr.expiresAt];

    if (typeof deviceId !== 'string' || typeof accountId !== 'string') {
      continue;
    }
    assertDeviceId(deviceId);

    if (typeof expiresAtRaw !== 'string') {
      continue;
    }
    const exp = Date.parse(expiresAtRaw);
    assert.ok(!Number.isNaN(exp), 'session expiresAt must parse', {
      expiresAtRaw,
    });
    if (exp <= now) {
      continue;
    }

    return accountId;
  }

  return null;
}

function parseSpaceIdFromTopic(topic: string): string | null {
  if (!topic.startsWith(ROOM_TOPIC_PREFIX)) return null;
  const id = topic.slice(ROOM_TOPIC_PREFIX.length);
  return id.length > 0 ? id : null;
}

function spaceEntityIsLive(
  attrs: Record<string, unknown> | undefined
): boolean {
  const ended = attrs?.[SpaceAttr.endedAt];
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
  const raw = space.attributes[SpaceAttr.hostId];
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
  const leftAt = mem.attributes[SpaceMembershipAttr.leftAt];
  if (leftAt !== undefined && leftAt !== null) {
    return jsonResponse(403, 'membership inactive');
  }
  const memSpaceId = mem.attributes[SpaceMembershipAttr.spaceId];
  if (typeof memSpaceId !== 'string' || memSpaceId !== spaceId) {
    return jsonResponse(403, 'not a member of this space');
  }
  return null;
}

/**
 * Validates the WebSocket upgrade for `/space/ws`: Bearer (account) or anon id,
 * topic shape, and that the caller is the space host or an active guest member.
 */
export async function authorizeRoomWebSocket(
  db: PatchDb,
  request: Request,
  topic: string
): Promise<{ myId: string } | Response> {
  const bearer = parseBearerFromUrlOrHeader(request);
  let myId: string | null = null;

  if (bearer !== null) {
    myId = await resolveMyIdFromBearer(db, bearer);
    if (myId === null) {
      return jsonResponse(401, 'invalid or expired session');
    }
  } else {
    const anon = parseAnonIdFromRequest(request);
    if (anon === null || anon.length === 0) {
      return jsonResponse(401, 'missing session token or anon id');
    }
    assertDeviceId(anon);
    myId = anon;
  }

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

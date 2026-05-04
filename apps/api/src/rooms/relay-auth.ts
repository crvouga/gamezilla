import { AccountSessionAttr } from '@gamezilla/domain/auth';
import { assertDeviceId } from '@gamezilla/domain/auth/device-id';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { assert } from '@gamezilla/lib/assert';
import type { Entity, PatchDb } from '@gamezilla/patch-db/interface';
import { PATCHES_DB_SYSTEM_CONTEXT } from '@gamezilla/patch-db/interface';

import { readAccountSessionsByToken } from '../auth/account-session-by-token';

const ROOM_TOPIC_PREFIX = 'space:' as const;

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

async function resolveAccountIdFromBearer(
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

function readHostAccountId(space: Entity): string {
  const raw = space.attributes[SpaceAttr.hostId];
  return typeof raw === 'string' ? raw : '';
}

async function readMembershipRow(
  db: PatchDb,
  accountId: string
): Promise<Entity | null> {
  const [memRes] = await db.read(
    [
      {
        entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
        entityId: accountId,
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
 * Validates the WebSocket upgrade for `/room/ws`: bearer session, topic shape,
 * and that the account is the space host or has an active membership row for
 * that space.
 */
export async function authorizeRoomWebSocket(
  db: PatchDb,
  request: Request,
  topic: string
): Promise<{ accountId: string } | Response> {
  const bearer = parseBearerFromUrlOrHeader(request);
  if (bearer === null) {
    return jsonResponse(401, 'missing session token');
  }

  const accountId = await resolveAccountIdFromBearer(db, bearer);
  if (accountId === null) {
    return jsonResponse(401, 'invalid or expired session');
  }

  const spaceId = parseSpaceIdFromTopic(topic);
  if (spaceId === null) {
    return jsonResponse(400, 'invalid topic');
  }

  const space = await readSpaceEntity(db, spaceId);
  if (!space || !spaceEntityIsLive(space.attributes)) {
    return jsonResponse(403, 'space not found or ended');
  }

  if (readHostAccountId(space) === accountId) {
    return { accountId };
  }

  const denied = guestMembershipDenied(
    await readMembershipRow(db, accountId),
    spaceId
  );
  return denied ?? { accountId };
}

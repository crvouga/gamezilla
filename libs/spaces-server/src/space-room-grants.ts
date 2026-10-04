/**
 * What the room gateway admits a connection to a space's room with: each
 * permission the space room enforces, decided through `@libs/permissions`
 * for the connecting actor with their presence role in the space read from
 * the stored rows (host / joined / not in it) — the same decision the spaces
 * mutations take.
 *
 * Decided once, at upgrade; the room keeps the answer for the life of the
 * connection. The only grant today is the game choice, held by the host
 * alone, and a space's host never changes while it is live: the host leaving
 * ends the space. So a stale answer can only be a host's connection to a
 * space they have since ended, where a game choice changes nothing anyone
 * sees. Every reconnect decides afresh.
 */

import type { RoomGrantsCtx } from '@libs/feature-shared/server';
import { decideOnServer } from '@libs/permissions-server/decide-on-server';

import { SPACE_ROOM_GRANT_KEYS } from '@libs/spaces-shared/space-room-authorize';
import { storedSpacePresence } from '@libs/spaces-shared/stored-space-presence';

const SPACE_ROOM_TOPIC_PREFIX = 'space:';

function spaceIdOf(topic: string): string | null {
  if (!topic.startsWith(SPACE_ROOM_TOPIC_PREFIX)) return null;
  const spaceId = topic.slice(SPACE_ROOM_TOPIC_PREFIX.length);
  return spaceId.length > 0 ? spaceId : null;
}

/** The space-room grants the connecting actor holds; none for other topics. */
export async function spaceRoomGrants(
  ctx: RoomGrantsCtx
): Promise<readonly string[]> {
  const spaceId = spaceIdOf(ctx.topic);
  if (spaceId === null) return [];
  const presence = await storedSpacePresence(ctx.db, spaceId, ctx.actor);
  const granted: string[] = [];
  for (const key of SPACE_ROOM_GRANT_KEYS) {
    const decision = await decideOnServer(ctx.db, {
      actor: ctx.actor,
      key,
      nowMs: ctx.nowMs,
      scope: { spacePresence: presence },
    });
    if (decision.allowed) granted.push(key);
  }
  return granted;
}

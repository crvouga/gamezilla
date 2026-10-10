/**
 * What the room gateway admits a connection to a space's room with: each
 * permission the space room enforces, decided through `@libs/permissions`
 * for the connecting actor with their presence role in the space read from
 * the stored rows (host / joined / not in it) — the same decision the spaces
 * mutations take.
 *
 * Decided on every connection; participant commands also check current
 * domain membership, so leaving revokes an already admitted participant.
 */

import type { RoomGrantsCtx } from '@libs/feature-shared/server';
import { decideOnServer } from '@libs/permissions-server/decide-on-server';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { SPACE_ROOM_GRANT_KEYS } from '@libs/spaces-shared/space-room-authorize';
import { storedSpacePresence } from '@libs/spaces-shared/stored-space-presence';
import sql from '@pkgs/sql-root-shared/sql';

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
  // A public link observes host availability before taking a seat. The
  // command boundary still requires membership for every participant command.
  const publicSpace = await ctx.db.query(sql<{ readonly id: string }>`
    SELECT id FROM spaces WHERE id = ${spaceId}
      AND visibility = ${'public'} AND deleted_at IS NULL AND ended_at IS NULL
  `);
  if (publicSpace.length > 0) {
    const preview = await decideOnServer(ctx.db, {
      actor: ctx.actor,
      key: PERMISSION.spacesJoin,
      nowMs: ctx.nowMs,
      scope: { spacePresence: presence },
    });
    if (preview.allowed) granted.push(PERMISSION.spacesJoin);
  }
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

import type { FeatureServer, RoomGrantsCtx } from '@libs/feature/public/server';
import { decideOnServer } from '@libs/permissions/root/server/decide-on-server';
import { storedSpacePresence } from '@libs/spaces/public/stored-space-presence';
import { CUSTOM_GAME_GRANT_KEYS } from '../../use-cases/change-custom-game/shared/custom-game-permissions';

async function customGameRoomGrants(
  ctx: RoomGrantsCtx
): Promise<readonly string[]> {
  if (!ctx.topic.startsWith('space:')) return [];
  const presence = await storedSpacePresence(
    ctx.db,
    ctx.topic.slice('space:'.length),
    ctx.actor
  );
  const grants: string[] = [];
  for (const key of CUSTOM_GAME_GRANT_KEYS) {
    const decision = await decideOnServer(ctx.db, {
      actor: ctx.actor,
      key,
      nowMs: ctx.nowMs,
      scope: { spacePresence: presence },
    });
    if (decision.allowed) grants.push(key);
  }
  return grants;
}

export const CHESS_SERVER: FeatureServer = {
  name: 'chess',
  roomGrants: customGameRoomGrants,
};

import {
  defineFeatureServer,
  type RoomGrantsCtx,
} from '@libs/feature/public/server';
import { decideOnServer } from '@libs/permissions/root/server/decide-on-server';
import { storedSpacePresence } from '@libs/spaces/public/stored-space-presence';
import { defineOutboxConsumer } from '@pkgs/outbox';
import { formChessMatches } from '../../shared/multiplayer/match-handoff';
import { OpponentRequested } from '../../shared/multiplayer/opponent-requested';
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

export const CHESS_SERVER = defineFeatureServer({
  name: 'chess',
  roomGrants: customGameRoomGrants,
  registerOutbox(registry) {
    registry.register(
      defineOutboxConsumer({
        id: 'chess.form-opponent-match',
        on: OpponentRequested,
        async handler(ctx) {
          const ids = await formChessMatches(ctx.tx, {
            nowMs: ctx.clock.now(),
            createId: ctx.createId,
          });
          return { notifyUserIds: ids };
        },
      })
    );
  },
});

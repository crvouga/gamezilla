import { CUSTOM_GAME_GRANT_KEYS } from '@libs/chess-custom-game-shared/custom-game-permissions';
import { formChessMatches } from '@libs/chess-matchmaking-shared/match-handoff';
import { OpponentRequested } from '@libs/chess-matchmaking-shared/opponent-requested';
import type { RoomGrantsCtx } from '@libs/feature-shared/server';
import { defineFeatureServer } from '@libs/feature-shared/server';
import { decideOnServer } from '@libs/permissions-server/decide-on-server';
import { storedSpacePresence } from '@libs/spaces-shared/stored-space-presence';
import { defineOutboxConsumer } from '@pkgs/outbox-shared/define-consumer';
import { createPuzzleManagementApp } from './puzzle-management-route';

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
  routes: (ctx) => createPuzzleManagementApp(ctx.clock, ctx.createId),
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

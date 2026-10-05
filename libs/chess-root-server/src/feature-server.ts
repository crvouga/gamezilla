import { CUSTOM_GAME_GRANT_KEYS } from '@libs/chess-custom-game-shared/custom-game-permissions';
import { scheduleFormationRetry } from '@libs/chess-matchmaking-shared/formation-retry';
import { formChessMatches } from '@libs/chess-matchmaking-shared/match-handoff';
import { MultiplayerDeadline } from '@libs/chess-matchmaking-shared/multiplayer-deadline';
import { OpponentRequested } from '@libs/chess-matchmaking-shared/opponent-requested';
import { settleDueGame } from '@libs/chess-matchmaking-shared/settle-due-game';
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
          await scheduleFormationRetry(ctx.tx, ctx.clock.now());
          return { notifyUserIds: ids };
        },
      })
    );
    registry.register(
      defineOutboxConsumer({
        id: 'chess.settle-multiplayer-deadline',
        on: MultiplayerDeadline,
        async handler(ctx, payload) {
          const ids = await settleDueGame(
            ctx.tx,
            payload.gameId,
            ctx.clock.now()
          );
          return { notifyUserIds: ids };
        },
      })
    );
  },
});

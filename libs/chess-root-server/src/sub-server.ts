import { CUSTOM_GAME_GRANT_KEYS } from '@libs/chess-custom-game-shared/custom-game-permissions';
import { scheduleFormationRetry } from '@libs/chess-matchmaking-shared/formation-retry';
import { formChessMatches } from '@libs/chess-matchmaking-shared/match-handoff';

import { MultiplayerDeadline } from '@libs/chess-matchmaking-shared/multiplayer-deadline';
import { OpponentRequested } from '@libs/chess-matchmaking-shared/opponent-requested';
import { settleDueGame } from '@libs/chess-matchmaking-shared/settle-due-game';
import { MULTIPLAYER_TELEMETRY } from '@libs/chess-matchmaking-shared/telemetry';
import { PUZZLE_TELEMETRY } from '@libs/chess-puzzle-shared/telemetry';
import { decideOnServer } from '@libs/permissions-server/decide-on-server';
import { storedSpacePresence } from '@libs/spaces-shared/stored-space-presence';
import type { RoomGrantsCtx } from '@libs/sub-shared/server';
import { defineSubServer } from '@libs/sub-shared/server';
import { defineOutboxConsumer } from '@pkgs/outbox-shared/define-consumer';
import type { RoomServicePort } from '@pkgs/room-root-shared/room-service';
import { multiplayerAvailabilityConsumer } from './multiplayer-availability-consumer';
import {
  multiplayerNoticesConsumer,
  registerMultiplayerNoticeActions,
} from './multiplayer-notices-consumer';
import {
  multiplayerRoomGrants,
  registerMatchRoomConsumers,
} from './multiplayer-room-server';
import { multiplayerTurnReminderConsumer } from './multiplayer-turn-reminder-consumer';
import { opponentSearchGuard } from './opponent-search-guard';
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

export function createChessServer(rooms: RoomServicePort) {
  return defineSubServer({
    telemetryEvents: [...MULTIPLAYER_TELEMETRY, ...PUZZLE_TELEMETRY],
    name: 'chess',
    routes: (ctx) => createPuzzleManagementApp(ctx.clock, ctx.createId),
    roomGrants: async (ctx) => [
      ...(await customGameRoomGrants(ctx)),
      ...(await multiplayerRoomGrants(ctx)),
    ],
    authorizeMutation: opponentSearchGuard(rooms),
    register: registerMultiplayerNoticeActions,
    registerOutbox(registry) {
      registerMatchRoomConsumers(registry, rooms);
      registry.register(multiplayerNoticesConsumer);
      registry.register(multiplayerTurnReminderConsumer);
      registry.register(multiplayerAvailabilityConsumer);
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
              ctx.clock.now(),
              ctx.createId
            );
            return { notifyUserIds: ids };
          },
        })
      );
    },
  });
}

import { scheduleFormationRetry } from '@libs/game-matchmaking-shared-ts/formation-retry';
import { formGameMatches } from '@libs/game-matchmaking-shared-ts/match-handoff';
import { MultiplayerDeadline } from '@libs/game-matchmaking-shared-ts/multiplayer-deadline';
import { OpponentRequested } from '@libs/game-matchmaking-shared-ts/opponent-requested';
import { settleDueGame } from '@libs/game-matchmaking-shared-ts/settle-due-game';
import { MULTIPLAYER_TELEMETRY } from '@libs/game-matchmaking-shared-ts/telemetry';
import { CUSTOM_GAME_GRANT_KEYS } from '@libs/game-session-shared-ts/custom-game-permissions';
import { decideOnServer } from '@libs/permissions-server-ts/decide-on-server';
import { storedSpacePresence } from '@libs/spaces-shared-ts/stored-space-presence';
import type { RoomGrantsCtx } from '@libs/sub-shared-ts/server';
import { defineSubServer } from '@libs/sub-shared-ts/server';
import { defineOutboxConsumer } from '@pkgs/outbox-shared-ts/define-consumer';
import type { RoomServicePort } from '@pkgs/room-root-shared-ts/room-service';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { createMultiplayerAvailabilityConsumer } from './multiplayer-availability-consumer';
import {
  createMultiplayerNoticesConsumer,
  registerMultiplayerNoticeActions,
} from './multiplayer-notices-consumer';
import {
  multiplayerRoomGrants,
  registerMatchRoomConsumers,
} from './multiplayer-room-server';
import { createMultiplayerTurnReminderConsumer } from './multiplayer-turn-reminder-consumer';
import { opponentSearchGuard } from './opponent-search-guard';

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

export function createGameSessionServer(
  rooms: RoomServicePort,
  rules: TurnGames
) {
  return defineSubServer({
    telemetryEvents: MULTIPLAYER_TELEMETRY,
    name: 'game-session',
    roomGrants: async (ctx) => [
      ...(await customGameRoomGrants(ctx)),
      ...(await multiplayerRoomGrants(ctx)),
    ],
    authorizeMutation: opponentSearchGuard(rooms),
    register: registerMultiplayerNoticeActions,
    registerOutbox(registry) {
      registerMatchRoomConsumers(registry, rooms);
      registry.register(createMultiplayerNoticesConsumer(rules));
      registry.register(createMultiplayerTurnReminderConsumer(rules));
      registry.register(createMultiplayerAvailabilityConsumer(rules));
      registry.register(
        defineOutboxConsumer({
          id: 'chess.form-opponent-match',
          on: OpponentRequested,
          async handler(ctx) {
            const ids = await formGameMatches(
              ctx.tx,
              {
                nowMs: ctx.clock.now(),
                createId: ctx.createId,
              },
              rules
            );
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
              {
                gameId: payload.gameId,
                nowMs: ctx.clock.now(),
                createId: ctx.createId,
              },
              rules,
              rooms
            );
            return { notifyUserIds: ids };
          },
        })
      );
    },
  });
}

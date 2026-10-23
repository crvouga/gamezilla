import {
  changeMultiplayerAvailability,
  MultiplayerAvailability,
} from '@libs/game-matchmaking-shared-ts/multiplayer-availability';
import { defineOutboxConsumer } from '@pkgs/outbox-shared-ts/define-consumer';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';

export function createMultiplayerAvailabilityConsumer(rules: TurnGames) {
  return defineOutboxConsumer({
    id: 'chess.multiplayer-availability',
    on: MultiplayerAvailability,
    async handler(ctx, payload) {
      const ids = await changeMultiplayerAvailability(
        ctx.tx,
        {
          ...payload,
          nowMs: ctx.clock.now(),
          createId: ctx.createId,
        },
        rules
      );
      return { notifyUserIds: ids };
    },
  });
}

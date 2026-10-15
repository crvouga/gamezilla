import {
  changeMultiplayerAvailability,
  MultiplayerAvailability,
} from '@libs/chess-matchmaking-shared/multiplayer-availability';
import { defineOutboxConsumer } from '@pkgs/outbox-shared/define-consumer';

export const multiplayerAvailabilityConsumer = defineOutboxConsumer({
  id: 'chess.multiplayer-availability',
  on: MultiplayerAvailability,
  async handler(ctx, payload) {
    const ids = await changeMultiplayerAvailability(ctx.tx, {
      ...payload,
      nowMs: ctx.clock.now(),
      createId: ctx.createId,
    });
    return { notifyUserIds: ids };
  },
});

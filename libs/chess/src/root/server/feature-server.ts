import { defineFeatureServer } from '@libs/feature/public/server';
import { defineOutboxConsumer } from '@pkgs/outbox';
import { formChessMatches } from '../../shared/multiplayer/match-handoff';
import { OpponentRequested } from '../../shared/multiplayer/opponent-requested';

export const CHESS_SERVER = defineFeatureServer({
  name: 'chess',
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

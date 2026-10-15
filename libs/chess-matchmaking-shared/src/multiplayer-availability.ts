import { createMessageNamespace } from '@pkgs/message-shared/message';
import { insertOutboxEvent } from '@pkgs/outbox-shared/outbox';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import { z } from 'zod';
import { MultiplayerGameRepository } from './game-repository';
import { settleMultiplayerClock } from './multiplayer-clock';

const availabilitySchema = z
  .object({ gameId: z.string().min(1), available: z.boolean() })
  .strict();
/** Only the trusted server outbox delivers a shared availability transition. */
export const MultiplayerAvailability = createMessageNamespace(
  'chess',
  'outbox'
)(
  'multiplayer-availability',
  (value): value is z.infer<typeof availabilitySchema> =>
    availabilitySchema.safeParse(value).success
);

export async function enqueueMultiplayerAvailability(
  tx: SqlTx,
  input: {
    readonly gameId: string;
    readonly available: boolean;
    readonly nowMs: number;
    readonly createId: () => string;
  }
): Promise<void> {
  await insertOutboxEvent(tx, {
    id: input.createId(),
    message: MultiplayerAvailability({
      gameId: input.gameId,
      available: input.available,
    }),
    nowIso: new Date(input.nowMs).toISOString(),
  });
}

/** Trusted host lifecycle, serialized with moves through the same owner locks. */
export async function changeMultiplayerAvailability(
  tx: SqlTx,
  input: {
    readonly gameId: string;
    readonly available: boolean;
    readonly nowMs: number;
    readonly createId: () => string;
  }
): Promise<readonly string[]> {
  const repository = new MultiplayerGameRepository(tx);
  const found = await repository.byId(input.gameId);
  if (found === null)
    throw new Error('The shared multiplayer game is unavailable.');
  const stored = await repository.owned(
    input.gameId,
    found.white_id,
    input.nowMs
  );
  const game = settleMultiplayerClock(stored, input.nowMs);
  if (
    game.outcome !== 'ongoing' ||
    input.available === (game.paused_at_ms === null)
  ) {
    if (game !== stored)
      await repository.save(stored, game, input.nowMs, {
        server: true,
        publish: input,
      });
    return [game.white_id, game.black_id];
  }
  const resumed = input.available && game.paused_at_ms !== null;
  await repository.save(
    stored,
    {
      ...game,
      paused_at_ms: input.available ? null : input.nowMs,
      clock_at_ms:
        resumed && game.clock_at_ms !== null
          ? game.clock_at_ms + input.nowMs - (game.paused_at_ms ?? input.nowMs)
          : game.clock_at_ms,
    },
    input.nowMs,
    { server: true, publish: input }
  );
  return [game.white_id, game.black_id];
}

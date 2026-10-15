import { PuzzleImportCleanup } from '@libs/chess-puzzle-shared/puzzle-import-event';
import { puzzleUploadPrefix } from '@libs/chess-puzzle-shared/puzzle-load-job';
import { defineOutboxConsumer } from '@pkgs/outbox-shared/define-consumer';
import { insertOutboxEvent } from '@pkgs/outbox-shared/outbox';
import type { OutboxConsumerCtx } from '@pkgs/outbox-shared/types';

/** Cleanup is delivered after commit, so a rolled-back batch never loses its source. */
export async function schedulePuzzleImportCleanup(
  ctx: OutboxConsumerCtx,
  actorId: string,
  uploadId: string
): Promise<void> {
  await insertOutboxEvent(ctx.tx, {
    id: `puzzle-import-cleanup:${uploadId}`,
    message: PuzzleImportCleanup({ actorId, uploadId }),
    nowIso: new Date(ctx.clock.now()).toISOString(),
  });
}

export const puzzleImportCleanupConsumer = defineOutboxConsumer({
  delivery: 'background',
  id: 'chess.cleanup-puzzle-import',
  on: PuzzleImportCleanup,
  async handler(ctx, payload) {
    if (ctx.objectStore === undefined)
      throw new Error('Puzzle import requires object storage.');
    const keys = await ctx.objectStore.listKeys(
      puzzleUploadPrefix(payload.actorId, payload.uploadId)
    );
    await ctx.objectStore.deleteMany([...keys]);
  },
});

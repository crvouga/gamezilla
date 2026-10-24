import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { z } from 'zod';
import { readAttemptPosition, requireAttemptPlayer } from './attempt-store';
import { contentId } from './content-types';
import { saveAttemptPosition } from './save-attempt-position';

export const choosePuzzleContinuationMutation = defineMutation({
  name: 'choosePuzzleContinuation',
  args: z
    .object({
      attemptId: contentId,
      expectedPositionId: contentId,
      positionId: contentId,
      continuationId: contentId,
    })
    .strict(),
  async run(ctx, args) {
    const attempt = await requireAttemptPlayer(ctx, args.attemptId);
    const chosen = await readAttemptPosition(ctx.tx, attempt, args.positionId);
    await readAttemptPosition(ctx.tx, attempt, args.expectedPositionId);
    // Every head has a fresh identity, including a deliberate return to a kept state.
    // Replaying an older choice can then compare its parent without revisiting it.
    await saveAttemptPosition(ctx, {
      attempt,
      positionId: args.continuationId,
      parentId: args.expectedPositionId,
      history: chosen.history,
      onConflict: 'refuse',
    });
  },
});

import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { z } from 'zod';
import { readAttemptPosition, requireAttemptPlayer } from './attempt-store';
import { contentId } from './content-types';

export const choosePuzzleContinuationMutation = defineMutation({
  name: 'choosePuzzleContinuation',
  args: z
    .object({
      attemptId: contentId,
      expectedPositionId: contentId,
      positionId: contentId,
    })
    .strict(),
  async run(ctx, args) {
    const attempt = await requireAttemptPlayer(ctx, args.attemptId);
    await readAttemptPosition(ctx.tx, attempt, args.positionId);
    if (attempt.current_position_id === args.positionId) return;
    const changed = await ctx.tx.run(sql`
      UPDATE puzzle_content_attempts SET current_position_id = ${args.positionId}
      WHERE id = ${attempt.id} AND current_position_id = ${args.expectedPositionId} AND deleted_at IS NULL
    `);
    if (changed.changes === 0)
      throw new MutationError(
        'PUZZLE_CONTINUATION_CHANGED',
        'Your chosen continuation changed. Review the kept positions and choose again.'
      );
  },
});

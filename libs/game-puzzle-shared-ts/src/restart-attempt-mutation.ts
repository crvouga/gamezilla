import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import type { PuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import { attemptDefinition, requireAttemptPlayer } from './attempt-store';
import type { ContentMutationCtx } from './content-store';
import { contentId } from './content-types';
import { attemptStartSchema, createContentAttempt } from './create-attempt';

export const restartPuzzleAttemptMutation = (
  puzzleContents: PuzzleContentCatalog
) =>
  defineMutation({
    name: 'restartPuzzleAttempt',
    args: attemptStartSchema.extend({ earlierAttemptId: contentId }).strict(),
    async run(baseCtx, args) {
      const ctx: ContentMutationCtx = { ...baseCtx, puzzleContents };
      const earlier = await requireAttemptPlayer(ctx, args.earlierAttemptId);
      const definition = await attemptDefinition(ctx, earlier);
      await createContentAttempt(ctx, args, {
        puzzleId: earlier.puzzle_id,
        sourceId: earlier.source_id,
        gameId: earlier.game_id,
        definition,
        mode: earlier.mode,
        packRevisionId: earlier.pack_revision_id,
      });
    },
  });

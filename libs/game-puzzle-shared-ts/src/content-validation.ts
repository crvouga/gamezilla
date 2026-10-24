import type { PuzzleValidation } from '@pkgs/turn-game-shared-ts/puzzle-content';
import { validatePackDefinition } from './content-pack';
import type { ContentMutationCtx } from './content-store';
import { contentGame } from './content-store';
import type { ContentDocument, ContentDraft } from './content-types';

/** Always called again during publication; a saved valid flag is never authority. */
export async function validateContentDraft(
  ctx: ContentMutationCtx,
  doc: ContentDocument,
  draft: ContentDraft,
  solution?: string
): Promise<PuzzleValidation> {
  if (draft.title.trim().length === 0)
    return {
      valid: false,
      issues: [
        {
          code: 'PUZZLE_TITLE_REQUIRED',
          message: 'Name the puzzle or pack before publication.',
        },
      ],
    };
  const game = contentGame(ctx.puzzleContents, doc.game_id);
  if (doc.kind === 'pack')
    return validatePackDefinition(ctx.tx, doc, draft.definition);
  const structural = game.rules.validateDefinition(draft.definition);
  if (!structural.valid) return structural;
  if (game.validatePublication !== undefined)
    return game.validatePublication(
      draft.definition,
      solution ?? draft.validation_solution ?? undefined
    );
  const proof = solution ?? draft.validation_solution;
  if (proof != null && !game.rules.complete(draft.definition, proof))
    return {
      valid: false,
      issues: [
        {
          code: 'PUZZLE_PLAYTEST_INCOMPLETE',
          message:
            'Complete the playtest before using it as publication proof.',
        },
      ],
    };
  return { valid: true };
}

import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import type { PuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import { z } from 'zod';
import { encodeContentEvidence } from './content-evidence';
import type { ContentMutationCtx } from './content-store';
import {
  contentGame,
  readContentDraft,
  requireContentAuthor,
  requireDraftOf,
} from './content-store';
import { contentId } from './content-types';
import { validateContentDraft } from './content-validation';

export const validatePuzzleContentDraftMutation = (
  puzzleContents: PuzzleContentCatalog
) =>
  defineMutation({
    name: 'validatePuzzleContentDraft',
    args: z
      .object({
        documentId: contentId,
        draftId: contentId,
        playtestAttemptId: contentId.optional(),
      })
      .strict(),
    async run(baseCtx, args) {
      const ctx: ContentMutationCtx = { ...baseCtx, puzzleContents };
      const doc = await requireContentAuthor(ctx, args.documentId);
      const draft = requireDraftOf(
        doc,
        await readContentDraft(ctx.tx, args.draftId)
      );
      const { validation, evidence } = await validateContentDraft(
        ctx,
        doc,
        draft,
        args.playtestAttemptId
      );
      const game = contentGame(ctx.puzzleContents, doc.game_id);
      const kept = !validation.valid
        ? null
        : evidence === null
          ? draft.validation_solution
          : encodeContentEvidence(game, evidence);
      await ctx.tx.run(sql`
    UPDATE puzzle_content_drafts
    SET validation_status = ${validation.valid ? 'valid' : 'invalid'},
        validation_issues = ${JSON.stringify(validation.valid ? [] : validation.issues)},
        validation_solution = ${kept}
    WHERE id = ${draft.id}
  `);
    },
  });

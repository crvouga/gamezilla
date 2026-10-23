import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { z } from 'zod';
import {
  readContentDraft,
  requireContentAuthor,
  requireDraftOf,
} from './content-store';
import { contentId } from './content-types';
import { validateContentDraft } from './content-validation';

export const validatePuzzleContentDraftMutation = defineMutation({
  name: 'validatePuzzleContentDraft',
  args: z
    .object({
      documentId: contentId,
      draftId: contentId,
      solution: z.string().max(65_536).optional(),
    })
    .strict(),
  async run(ctx, args) {
    const doc = await requireContentAuthor(ctx, args.documentId);
    const draft = requireDraftOf(
      doc,
      await readContentDraft(ctx.tx, args.draftId)
    );
    const checked = await validateContentDraft(ctx, doc, draft, args.solution);
    await ctx.tx.run(sql`
      UPDATE puzzle_content_drafts
      SET validation_status = ${checked.valid ? 'valid' : 'invalid'},
          validation_issues = ${JSON.stringify(checked.valid ? [] : checked.issues)},
          validation_solution = ${checked.valid ? (args.solution ?? draft.validation_solution) : null}
      WHERE id = ${draft.id}
    `);
  },
});

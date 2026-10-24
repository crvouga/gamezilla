import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { z } from 'zod';
import {
  readContentDraft,
  requireContentAuthor,
  requireDraftOf,
} from './content-store';
import { contentBody, contentId } from './content-types';

export const choosePuzzleContentDraftMutation = defineMutation({
  name: 'choosePuzzleContentDraft',
  args: z
    .object({
      documentId: contentId,
      chosenDraftId: contentId,
      expectedDraftId: contentId,
      draftId: contentId,
    })
    .strict(),
  async run(ctx, args) {
    const doc = await requireContentAuthor(ctx, args.documentId);
    const chosen = requireDraftOf(
      doc,
      await readContentDraft(ctx.tx, args.chosenDraftId)
    );
    const existing = await readContentDraft(ctx.tx, args.draftId);
    if (existing !== null) {
      if (
        existing.document_id !== doc.id ||
        existing.parent_id !== chosen.id ||
        existing.conflicted ||
        JSON.stringify(contentBody(existing)) !==
          JSON.stringify(contentBody(chosen))
      )
        throw new MutationError(
          'PUZZLE_DRAFT_ID_REUSED',
          'This saved copy identity is already used. Choose the kept draft again.'
        );
    }
    const changed = await ctx.tx.run(sql`
      UPDATE puzzle_content_documents SET working_draft_id = ${args.draftId}
      WHERE id = ${doc.id} AND working_draft_id = ${args.expectedDraftId} AND deleted_at IS NULL
    `);
    if (existing !== null) return;
    if (changed.changes === 0)
      throw new MutationError(
        'PUZZLE_DRAFT_CHANGED',
        'Your working draft changed. Open the kept copies and choose again.'
      );
    await ctx.tx.run(sql`
      INSERT INTO puzzle_content_drafts
        (id, document_id, owner_id, parent_id, title, description, difficulty, definition, conflicted,
          validation_status, validation_issues, validation_solution)
      VALUES (${args.draftId}, ${doc.id}, ${doc.owner_id}, ${chosen.id},
        ${chosen.title}, ${chosen.description}, ${chosen.difficulty}, ${chosen.definition}, ${false},
        ${chosen.validation_status}, ${chosen.validation_issues}, ${chosen.validation_solution})
    `);
  },
});

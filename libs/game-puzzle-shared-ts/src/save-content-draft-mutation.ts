import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { z } from 'zod';
import {
  readContentDraft,
  requireContentAuthor,
  requireDraftOf,
} from './content-store';
import { contentBody, contentBodySchema, contentId } from './content-types';

export const savePuzzleContentDraftMutation = defineMutation({
  name: 'savePuzzleContentDraft',
  args: z
    .object({
      documentId: contentId,
      draftId: contentId,
      parentId: contentId,
      body: contentBodySchema,
    })
    .strict(),
  async run(ctx, args) {
    const doc = await requireContentAuthor(ctx, args.documentId);
    const parent = requireDraftOf(
      doc,
      await readContentDraft(ctx.tx, args.parentId)
    );
    const existing = await readContentDraft(ctx.tx, args.draftId);
    if (existing !== null) {
      if (
        existing.document_id !== doc.id ||
        existing.parent_id !== args.parentId ||
        JSON.stringify(contentBody(existing)) !== JSON.stringify(args.body)
      )
        throw new MutationError(
          'PUZZLE_DRAFT_ID_REUSED',
          'This saved draft identity is already used. Save a new draft copy.'
        );
    }
    const body = args.body;
    // Details-only edits keep the evidence; any use replays it against this definition.
    const evidence =
      parent.definition === body.definition ? parent.validation_solution : null;
    if (existing === null)
      await ctx.tx.run(sql`
      INSERT INTO puzzle_content_drafts
        (id, document_id, owner_id, parent_id, title, description, difficulty, definition, conflicted,
          validation_status, validation_issues, validation_solution)
      VALUES (${args.draftId}, ${doc.id}, ${doc.owner_id}, ${args.parentId},
        ${body.title}, ${body.description}, ${body.difficulty}, ${body.definition}, ${false},
        ${'unchecked'}, ${'[]'}, ${evidence})
    `);
    const changed = await ctx.tx.run(sql`
      UPDATE puzzle_content_documents SET working_draft_id = ${args.draftId}
      WHERE id = ${doc.id} AND working_draft_id = ${args.parentId} AND deleted_at IS NULL
    `);
    if (changed.changes === 0 && existing === null)
      await ctx.tx.run(sql`
      UPDATE puzzle_content_drafts SET conflicted = ${true} WHERE id = ${args.draftId}
    `);
  },
});

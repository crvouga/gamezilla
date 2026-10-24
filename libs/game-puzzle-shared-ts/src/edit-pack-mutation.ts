import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { z } from 'zod';
import { decodePackDefinition } from './content-pack';
import {
  readContentDraft,
  requireContentAuthor,
  requireDraftOf,
} from './content-store';
import { contentBody, contentId } from './content-types';
import { editPackDefinition, packEditSchema } from './pack-edit';
import { savePuzzleContentDraftMutation } from './save-content-draft-mutation';

export const editPuzzlePackMutation = defineMutation({
  name: 'editPuzzlePack',
  args: z
    .object({
      documentId: contentId,
      parentId: contentId,
      draftId: contentId,
      edit: packEditSchema,
    })
    .strict(),
  async run(ctx, args) {
    const doc = await requireContentAuthor(ctx, args.documentId);
    const draft = requireDraftOf(
      doc,
      await readContentDraft(ctx.tx, args.parentId)
    );
    const pack =
      doc.kind === 'pack' ? decodePackDefinition(draft.definition) : null;
    if (pack === null)
      throw new MutationError(
        'PACK_DETAILS_INVALID',
        'Open a readable pack draft before changing its puzzles.'
      );
    const edited = await editPackDefinition(ctx, doc, pack, args.edit);
    await savePuzzleContentDraftMutation.run(ctx, {
      documentId: doc.id,
      parentId: draft.id,
      draftId: args.draftId,
      body: { ...contentBody(draft), definition: JSON.stringify(edited) },
    });
  },
});

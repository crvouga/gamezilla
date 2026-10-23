import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { z } from 'zod';
import { decodePackDefinition } from './content-pack';
import {
  readContentDraft,
  requireContentAuthor,
  requireDraftOf,
} from './content-store';
import { contentBody, contentBodySchema, contentId } from './content-types';
import { createPuzzleContentMutation } from './create-content-mutation';
import { savePuzzleContentDraftMutation } from './save-content-draft-mutation';

export const createPuzzleFromPackMutation = defineMutation({
  name: 'createPuzzleFromPack',
  args: z
    .object({
      packId: contentId,
      parentId: contentId,
      packDraftId: contentId,
      puzzleId: contentId,
      puzzleDraftId: contentId,
      body: contentBodySchema,
    })
    .strict(),
  async run(ctx, args) {
    const doc = await requireContentAuthor(ctx, args.packId);
    const draft = requireDraftOf(
      doc,
      await readContentDraft(ctx.tx, args.parentId)
    );
    const pack =
      doc.kind === 'pack' ? decodePackDefinition(draft.definition) : null;
    if (pack === null)
      throw new MutationError(
        'PACK_DETAILS_INVALID',
        'Open a readable pack draft before creating a puzzle.'
      );
    if (pack.items.some((item) => item.puzzleId === args.puzzleId))
      throw new MutationError(
        'PACK_DUPLICATE_PUZZLE',
        'That puzzle is already in the pack.'
      );
    await createPuzzleContentMutation.run(ctx, {
      documentId: args.puzzleId,
      draftId: args.puzzleDraftId,
      gameId: doc.game_id,
      kind: 'puzzle',
      body: args.body,
    });
    await savePuzzleContentDraftMutation.run(ctx, {
      documentId: doc.id,
      parentId: draft.id,
      draftId: args.packDraftId,
      body: {
        ...contentBody(draft),
        definition: JSON.stringify({
          items: [...pack.items, { puzzleId: args.puzzleId, revisionId: null }],
        }),
      },
    });
  },
});

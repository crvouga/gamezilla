import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import {
  readContentDraft,
  requireContentAuthor,
  requireDraftOf,
} from './content-store';
import { contentId } from './content-types';
import { attemptStartSchema, createContentAttempt } from './create-attempt';

export const startPuzzlePlaytestMutation = defineMutation({
  name: 'startPuzzlePlaytest',
  args: attemptStartSchema
    .extend({ documentId: contentId, draftId: contentId })
    .strict(),
  async run(ctx, args) {
    const doc = await requireContentAuthor(
      ctx,
      args.documentId,
      PERMISSION.puzzlesPlaytestContent
    );
    const draft = requireDraftOf(
      doc,
      await readContentDraft(ctx.tx, args.draftId)
    );
    await createContentAttempt(ctx, args, {
      puzzleId: doc.id,
      sourceId: draft.id,
      gameId: doc.game_id,
      definition: draft.definition,
      mode: 'playtest',
      packRevisionId: null,
    });
  },
});

import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import {
  type MutationDb,
  MutationError,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { PuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import { z } from 'zod';
import { resolvePackDraft, writePackReferences } from './content-pack';
import { writeContentPublication } from './content-publication';
import type { ContentMutationCtx } from './content-store';
import {
  contentGame,
  readContentDraft,
  readContentRevision,
  requireContentAuthor,
  requireDraftOf,
} from './content-store';
import {
  type ContentDocument,
  type ContentDraft,
  contentId,
} from './content-types';
import { validateContentDraft } from './content-validation';

/** Checked again at publication, from the stored draft and replayed evidence. */
async function requirePublishableDraft(
  ctx: ContentMutationCtx,
  doc: ContentDocument,
  draftId: string,
  playtestAttemptId: string | undefined
): Promise<ContentDraft> {
  const draft = requireDraftOf(doc, await readContentDraft(ctx.tx, draftId));
  const { validation } = await validateContentDraft(
    ctx,
    doc,
    draft,
    playtestAttemptId
  );
  if (!validation.valid)
    throw new MutationError(
      'PUZZLE_PUBLICATION_INVALID',
      validation.issues[0]?.message ?? 'Correct the draft before publication.',
      { issues: validation.issues }
    );
  return draft;
}

/** An edition pins its definition and the rules version it is played under. */
async function writeContentRevision(
  tx: MutationDb,
  edition: {
    readonly doc: ContentDocument;
    readonly draft: ContentDraft;
    readonly edition: number;
    readonly definition: string;
    readonly rulesVersion: number;
  }
): Promise<void> {
  const { doc, draft, definition, rulesVersion } = edition;
  await tx.run(sql`
    INSERT INTO puzzle_content_revisions
      (id, document_id, owner_id, game_id, kind, edition, title, description, difficulty, definition, rules_version)
    VALUES (${draft.id}, ${doc.id}, ${doc.owner_id}, ${doc.game_id}, ${doc.kind}, ${edition.edition},
      ${draft.title.trim()}, ${draft.description}, ${draft.difficulty}, ${definition}, ${rulesVersion})
    ON CONFLICT (id) DO UPDATE SET
      edition = excluded.edition, title = excluded.title,
      description = excluded.description, difficulty = excluded.difficulty,
      definition = excluded.definition, rules_version = excluded.rules_version, deleted_at = NULL
    WHERE puzzle_content_revisions.document_id = excluded.document_id
      AND puzzle_content_revisions.deleted_at IS NOT NULL
  `);
}

export const publishPuzzleContentMutation = (
  puzzleContents: PuzzleContentCatalog
) =>
  defineMutation({
    name: 'publishPuzzleContent',
    args: z
      .object({
        documentId: contentId,
        draftId: contentId,
        playtestAttemptId: contentId.optional(),
      })
      .strict(),
    async run(baseCtx, args) {
      const ctx: ContentMutationCtx = { ...baseCtx, puzzleContents };
      const doc = await requireContentAuthor(
        ctx,
        args.documentId,
        PERMISSION.puzzlesPublishContent
      );
      // A repeated old request cannot replace a later publication or undo withdrawal.
      const existing = await readContentRevision(ctx.tx, args.draftId);
      if (existing !== null) {
        if (existing.document_id !== doc.id)
          throw new MutationError(
            'PUZZLE_EDITION_ID_REUSED',
            'Choose a saved draft belonging to this puzzle.'
          );
        return;
      }
      if (doc.working_draft_id !== args.draftId)
        throw new MutationError(
          'PUZZLE_DRAFT_CHANGED',
          'Your working draft changed. Open the kept copies and publish the one you choose.'
        );
      const draft = await requirePublishableDraft(
        ctx,
        doc,
        args.draftId,
        args.playtestAttemptId
      );
      const definition =
        doc.kind === 'pack'
          ? await resolvePackDraft(ctx.tx, draft.definition)
          : draft.definition;
      const rulesVersion = contentGame(
        ctx.puzzleContents,
        doc.game_id
      ).rulesVersion;
      const edition = doc.publication_count + 1;
      const changed = await ctx.tx.run(sql`
    UPDATE puzzle_content_documents
    SET published_revision_id = ${draft.id}, publication_count = ${edition}, status = ${'published'}
    WHERE id = ${doc.id} AND working_draft_id = ${draft.id}
      AND publication_count = ${doc.publication_count} AND deleted_at IS NULL
  `);
      if (changed.changes === 0) {
        if ((await readContentRevision(ctx.tx, draft.id)) !== null) return;
        throw new MutationError(
          'PUZZLE_DRAFT_CHANGED',
          'Your working draft changed. Review your kept draft copies before publishing.'
        );
      }
      await writeContentRevision(ctx.tx, {
        doc,
        draft,
        edition,
        definition,
        rulesVersion,
      });
      if (doc.kind === 'pack')
        await writePackReferences(ctx.tx, doc, definition);
      await writeContentPublication(ctx.tx, {
        id: doc.id,
        owner_id: doc.owner_id,
        game_id: doc.game_id,
        kind: doc.kind,
        published_revision_id: draft.id,
        publication_count: edition,
        status: 'published',
        deleted_at: null,
      });
    },
  });

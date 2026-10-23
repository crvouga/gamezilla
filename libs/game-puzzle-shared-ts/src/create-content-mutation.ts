import { requireInMutation } from '@libs/permissions-shared-ts/mutation-permission';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { PuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import { z } from 'zod';
import type { ContentMutationCtx } from './content-store';
import {
  contentGame,
  readContentDocument,
  readContentDraft,
  requireContentAuthor,
} from './content-store';
import { contentBody, contentBodySchema, contentId } from './content-types';

export const createPuzzleContentMutation = (
  puzzleContents: PuzzleContentCatalog
) =>
  defineMutation({
    name: 'createPuzzleContent',
    args: z
      .object({
        documentId: contentId,
        draftId: contentId,
        gameId: z.string().min(1).max(32),
        kind: z.enum(['puzzle', 'pack']),
        body: contentBodySchema,
      })
      .strict(),
    async run(baseCtx, args) {
      const ctx: ContentMutationCtx = { ...baseCtx, puzzleContents };
      await requireInMutation(ctx, PERMISSION.puzzlesCreateContent);
      contentGame(ctx.puzzleContents, args.gameId);
      const existing = await readContentDocument(ctx.tx, args.documentId);
      if (existing !== null) {
        await requireContentAuthor(ctx, args.documentId);
        const initial = await readContentDraft(ctx.tx, args.draftId);
        if (
          existing.game_id !== args.gameId ||
          existing.kind !== args.kind ||
          initial === null ||
          initial.document_id !== existing.id ||
          initial.parent_id !== null ||
          JSON.stringify(contentBody(initial)) !== JSON.stringify(args.body)
        )
          throw new MutationError(
            'PUZZLE_CONTENT_ID_REUSED',
            'This draft identity is already used. Create a new draft.'
          );
        return;
      }
      await ctx.tx.run(sql`
    INSERT INTO puzzle_content_documents
      (id, owner_id, game_id, kind, working_draft_id, published_revision_id, publication_count, status)
    VALUES (${args.documentId}, ${ctx.env.actorId}, ${args.gameId}, ${args.kind}, ${args.draftId}, ${null}, ${0}, ${'draft'})
  `);
      const body = args.body;
      await ctx.tx.run(sql`
    INSERT INTO puzzle_content_drafts
      (id, document_id, owner_id, parent_id, title, description, difficulty, definition, conflicted,
        validation_status, validation_issues, validation_solution)
    VALUES (${args.draftId}, ${args.documentId}, ${ctx.env.actorId}, ${null},
      ${body.title}, ${body.description}, ${body.difficulty}, ${body.definition}, ${false},
      ${'unchecked'}, ${'[]'}, ${null})
  `);
    },
  });

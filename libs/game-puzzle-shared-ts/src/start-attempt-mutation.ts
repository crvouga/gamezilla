import { requireInMutation } from '@libs/permissions-shared-ts/mutation-permission';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { PuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import { isBundledContent } from './bundled-content';
import { decodePackDefinition } from './content-pack';
import type { ContentMutationCtx } from './content-store';
import { readEdition, readEditionDocument } from './content-store';
import type { ContentRevision } from './content-types';
import { contentId } from './content-types';
import { attemptStartSchema, createContentAttempt } from './create-attempt';

/** A shipped pack's references are its definition; a published one's are materialized. */
async function packReferences(
  ctx: ContentMutationCtx,
  pack: ContentRevision,
  puzzleRevisionId: string
): Promise<number> {
  if (isBundledContent(pack.id))
    return (
      decodePackDefinition(pack.definition)?.items.filter(
        (item) => item.revisionId === puzzleRevisionId
      ).length ?? 0
    );
  const items = await ctx.tx.query(
    sql<{
      id: string;
    }>`SELECT id FROM puzzle_content_pack_items WHERE pack_revision_id = ${pack.id} AND puzzle_revision_id = ${puzzleRevisionId} AND deleted_at IS NULL`
  );
  return items.length;
}

async function requirePackChoice(
  ctx: ContentMutationCtx,
  packRevisionId: string,
  puzzleRevisionId: string
): Promise<void> {
  const pack = await readEdition(ctx, packRevisionId);
  const doc =
    pack === null ? null : await readEditionDocument(ctx, pack.document_id);
  if (
    pack?.kind !== 'pack' ||
    doc?.status !== 'published' ||
    (await packReferences(ctx, pack, puzzleRevisionId)) !== 1
  )
    throw new MutationError(
      'PUZZLE_UNAVAILABLE',
      'Open an available pack and choose one of its puzzles.'
    );
}

export const startPuzzleAttemptMutation = (
  puzzleContents: PuzzleContentCatalog
) =>
  defineMutation({
    name: 'startPuzzleAttempt',
    args: attemptStartSchema
      .extend({ revisionId: contentId, packRevisionId: contentId.nullable() })
      .strict(),
    async run(baseCtx, args) {
      const ctx: ContentMutationCtx = { ...baseCtx, puzzleContents };
      await requireInMutation(ctx, PERMISSION.puzzlesPlay);
      const revision = await readEdition(ctx, args.revisionId);
      const doc =
        revision === null
          ? null
          : await readEditionDocument(ctx, revision.document_id);
      if (revision?.kind !== 'puzzle' || doc === null)
        throw new MutationError(
          'PUZZLE_UNAVAILABLE',
          'This puzzle is not available. Choose an available puzzle.'
        );
      if (args.packRevisionId !== null)
        await requirePackChoice(ctx, args.packRevisionId, revision.id);
      else if (doc.status !== 'published')
        throw new MutationError(
          'PUZZLE_UNAVAILABLE',
          'This puzzle is not available. Choose an available puzzle.'
        );
      await createContentAttempt(ctx, args, {
        puzzleId: doc.id,
        sourceId: revision.id,
        gameId: revision.game_id,
        definition: revision.definition,
        mode: 'ordinary',
        packRevisionId: args.packRevisionId,
        rulesVersion: revision.rules_version,
      });
    },
  });

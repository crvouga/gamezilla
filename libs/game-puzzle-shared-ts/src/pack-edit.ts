import {
  type MutationCtx,
  MutationError,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import { z } from 'zod';
import { reorderPack } from './content-pack';
import { readContentDocument } from './content-store';
import {
  type ContentDocument,
  contentId,
  type PackDefinition,
} from './content-types';

export const packEditSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('add'), puzzleId: contentId }).strict(),
  z.object({ kind: z.literal('remove'), puzzleId: contentId }).strict(),
  z
    .object({
      kind: z.literal('move'),
      puzzleId: contentId,
      beforeId: contentId,
    })
    .strict(),
]);
export type PackEdit = z.infer<typeof packEditSchema>;

export async function editPackDefinition(
  ctx: MutationCtx,
  doc: ContentDocument,
  pack: PackDefinition,
  edit: PackEdit
): Promise<PackDefinition> {
  if (edit.kind === 'remove')
    return {
      items: pack.items.filter((item) => item.puzzleId !== edit.puzzleId),
    };
  if (edit.kind === 'move')
    return reorderPack(pack, edit.puzzleId, edit.beforeId);
  if (pack.items.some((item) => item.puzzleId === edit.puzzleId))
    throw new MutationError(
      'PACK_DUPLICATE_PUZZLE',
      'That puzzle is already in the pack.'
    );
  const puzzle = await readContentDocument(ctx.tx, edit.puzzleId);
  if (
    puzzle === null ||
    puzzle.kind !== 'puzzle' ||
    puzzle.status !== 'published' ||
    puzzle.published_revision_id === null
  )
    throw new MutationError(
      'PACK_PUZZLE_UNAVAILABLE',
      'Choose an available published puzzle.'
    );
  if (puzzle.game_id !== doc.game_id)
    throw new MutationError(
      'PACK_GAME_MISMATCH',
      'Pack puzzles must belong to the same game.'
    );
  return {
    items: [
      ...pack.items,
      { puzzleId: puzzle.id, revisionId: puzzle.published_revision_id },
    ],
  };
}

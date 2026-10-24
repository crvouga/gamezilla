import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationDb } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { PuzzleValidation } from '@pkgs/turn-game-shared-ts/puzzle-content';
import { readContentDocument, readContentRevision } from './content-store';
import {
  type ContentDocument,
  type PackDefinition,
  packDefinitionSchema,
} from './content-types';

export function decodePackDefinition(text: string): PackDefinition | null {
  try {
    const result = packDefinitionSchema.safeParse(JSON.parse(text));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

const invalid = (code: string, message: string): PuzzleValidation => ({
  valid: false,
  issues: [{ code, message }],
});

export async function validatePackDefinition(
  tx: MutationDb,
  doc: ContentDocument,
  text: string
): Promise<PuzzleValidation> {
  const pack = decodePackDefinition(await resolvePackDraft(tx, text));
  if (pack === null)
    return invalid(
      'PACK_DETAILS_INVALID',
      'The pack details cannot be read. Open a saved draft copy.'
    );
  if (pack.items.length === 0)
    return invalid('PACK_EMPTY', 'Add a puzzle before publishing the pack.');
  const seen = new Set<string>();
  for (const item of pack.items) {
    if (seen.has(item.puzzleId))
      return invalid(
        'PACK_DUPLICATE_PUZZLE',
        'A puzzle may appear only once in a pack. Remove its duplicate.'
      );
    seen.add(item.puzzleId);
    if (item.revisionId === null)
      return invalid(
        'PACK_PUZZLE_UNPUBLISHED',
        'Publish the pack’s puzzles first.'
      );
    const puzzle = await readContentDocument(tx, item.puzzleId);
    const revision = await readContentRevision(tx, item.revisionId);
    if (puzzle === null || puzzle.status !== 'published')
      return invalid(
        'PACK_PUZZLE_UNAVAILABLE',
        'A pack puzzle is no longer available. Remove it or choose another published puzzle.'
      );
    if (puzzle.kind !== 'puzzle' || puzzle.game_id !== doc.game_id)
      return invalid(
        'PACK_GAME_MISMATCH',
        'Pack puzzles must belong to the same game.'
      );
    if (
      revision === null ||
      revision.document_id !== puzzle.id ||
      revision.kind !== 'puzzle' ||
      revision.game_id !== doc.game_id
    )
      return invalid(
        'PACK_PUZZLE_UNPUBLISHED',
        'Choose a published edition for each pack puzzle.'
      );
  }
  return { valid: true };
}

/** Newly authored entries choose an available edition when the pack is published. */
export async function resolvePackDraft(
  tx: MutationDb,
  text: string
): Promise<string> {
  const pack = decodePackDefinition(text);
  if (pack === null) return text;
  const items = [];
  for (const item of pack.items) {
    const puzzle =
      item.revisionId === null
        ? await readContentDocument(tx, item.puzzleId)
        : null;
    items.push({
      ...item,
      revisionId:
        item.revisionId ??
        (puzzle?.status === 'published' ? puzzle.published_revision_id : null),
    });
  }
  return JSON.stringify({ items });
}

export async function writePackReferences(
  tx: MutationDb,
  doc: ContentDocument,
  definition: string
): Promise<void> {
  const pack = decodePackDefinition(definition);
  if (pack === null) throw new Error('A validated pack must be readable');
  for (const [position, item] of pack.items.entries())
    await tx.run(sql`
    INSERT INTO puzzle_content_pack_items
      (id, owner_id, pack_revision_id, puzzle_id, puzzle_revision_id, position)
    VALUES (${`${doc.working_draft_id}:${position}`}, ${doc.owner_id}, ${doc.working_draft_id},
      ${item.puzzleId}, ${item.revisionId}, ${position})
    ON CONFLICT (id) DO UPDATE SET
      puzzle_id = excluded.puzzle_id,
      puzzle_revision_id = excluded.puzzle_revision_id,
      deleted_at = NULL
    WHERE puzzle_content_pack_items.pack_revision_id = excluded.pack_revision_id
      AND puzzle_content_pack_items.deleted_at IS NOT NULL
  `);
}

/** A new order is one whole draft snapshot; concurrent orders never merge by index. */
export function reorderPack(
  pack: PackDefinition,
  puzzleId: string,
  beforeId: string
): PackDefinition {
  const item = pack.items.find((entry) => entry.puzzleId === puzzleId);
  if (item === undefined || puzzleId === beforeId) return pack;
  const items = pack.items.filter((entry) => entry.puzzleId !== puzzleId);
  const index = items.findIndex((entry) => entry.puzzleId === beforeId);
  if (index < 0) return pack;
  return { items: [...items.slice(0, index), item, ...items.slice(index)] };
}

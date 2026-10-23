import type { ContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';

/** Starting another puzzle uses the pack edition's availability, independent of its latest edition. */
export function contentEditionAvailable(
  library: ContentLibrary,
  revisionId: string,
  packRevisionId: string | null
): boolean {
  const edition = library.revisions.find(
    (entry) => entry.id === (packRevisionId ?? revisionId)
  );
  if (edition === undefined || edition.deleted_at !== null) return false;
  if (packRevisionId !== null && edition.kind !== 'pack') return false;
  return library.documents.some(
    (doc) =>
      doc.id === edition.document_id &&
      doc.status === 'published' &&
      doc.deleted_at === null
  );
}

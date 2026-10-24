import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationDb } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { ContentDocument, ContentPublication } from './content-types';

export async function writeContentPublication(
  tx: MutationDb,
  publication: ContentPublication
): Promise<void> {
  await tx.run(sql`
    INSERT INTO puzzle_content_publications
      (id, owner_id, game_id, kind, published_revision_id, publication_count, status)
    VALUES (${publication.id}, ${publication.owner_id}, ${publication.game_id}, ${publication.kind},
      ${publication.published_revision_id}, ${publication.publication_count}, ${publication.status})
    ON CONFLICT (id) DO UPDATE SET
      published_revision_id = excluded.published_revision_id,
      publication_count = excluded.publication_count, status = excluded.status, deleted_at = NULL
  `);
}

/** Private documents retain the author's current working head; public heads are complete on their own. */
export function contentDocuments(
  documents: readonly ContentDocument[],
  publications: readonly ContentPublication[]
): readonly ContentDocument[] {
  const own = new Map(documents.map((document) => [document.id, document]));
  for (const publication of publications)
    if (!own.has(publication.id))
      own.set(publication.id, { ...publication, working_draft_id: null });
  return [...own.values()];
}

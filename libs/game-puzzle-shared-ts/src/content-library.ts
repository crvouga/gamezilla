import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationDb } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { contentDocuments } from './content-publication';
import type {
  ContentDocument,
  ContentDraft,
  ContentDraftRow,
  ContentPublication,
  ContentRevision,
} from './content-types';
import { contentDraftOf } from './content-types';

/** A projection of already-authorized local SQLite rows, shared by all puzzle games. */
export type ContentLibrary = {
  readonly documents: readonly ContentDocument[];
  readonly drafts: readonly ContentDraft[];
  readonly revisions: readonly ContentRevision[];
};

export async function readContentLibrary(
  db: MutationDb
): Promise<ContentLibrary> {
  const documents = await db.query(
    sql<ContentDocument>`SELECT * FROM puzzle_content_documents WHERE deleted_at IS NULL`
  );
  const drafts = await db.query(
    sql<ContentDraftRow>`SELECT * FROM puzzle_content_drafts WHERE deleted_at IS NULL`
  );
  const publications = await db.query(
    sql<ContentPublication>`SELECT * FROM puzzle_content_publications WHERE deleted_at IS NULL`
  );
  const revisions = await db.query(
    sql<ContentRevision>`SELECT * FROM puzzle_content_revisions WHERE deleted_at IS NULL`
  );
  return {
    documents: contentDocuments(documents, publications),
    drafts: drafts.map(contentDraftOf),
    revisions,
  };
}

export function discoverContent(
  library: ContentLibrary,
  gameId: string
): readonly ContentRevision[] {
  const current = new Set(
    library.documents
      .filter(
        (doc) =>
          doc.game_id === gameId &&
          doc.status === 'published' &&
          doc.deleted_at === null
      )
      .map((doc) => doc.published_revision_id)
  );
  return library.revisions.filter(
    (edition) => current.has(edition.id) && edition.deleted_at === null
  );
}

export function workingContentDraft(
  library: ContentLibrary,
  documentId: string
): ContentDraft | null {
  const doc = library.documents.find(
    (entry) => entry.id === documentId && entry.deleted_at === null
  );
  return (
    library.drafts.find(
      (draft) => draft.id === doc?.working_draft_id && draft.deleted_at === null
    ) ?? null
  );
}

export function contentDraftCopies(
  library: ContentLibrary,
  documentId: string
): readonly ContentDraft[] {
  return library.drafts.filter(
    (draft) => draft.document_id === documentId && draft.deleted_at === null
  );
}

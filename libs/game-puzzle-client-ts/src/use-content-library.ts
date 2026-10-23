import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { ContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import {
  type ContentDocument,
  type ContentDraftRow,
  type ContentRevision,
  contentDraftOf,
} from '@libs/game-puzzle-shared-ts/content-types';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  createQuery,
  useSyncEngine,
} from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { type Accessor, createMemo } from 'solid-js';

/** Local, already-authorized rows; the paint gate prevents an old identity flashing. */
export function useContentLibrary(gameId: Accessor<string>) {
  const myId = useMyId();
  const engine = useSyncEngine();
  const documents = createQuery(
    () =>
      sql<ContentDocument>`SELECT * FROM puzzle_content_documents WHERE game_id = ${gameId()}`
  );
  const drafts = createQuery(
    () =>
      sql<ContentDraftRow>`SELECT d.* FROM puzzle_content_drafts d INNER JOIN puzzle_content_documents p ON p.id = d.document_id WHERE p.game_id = ${gameId()} AND d.owner_id = ${myId()} AND d.deleted_at IS NULL`
  );
  const revisions = createQuery(
    () =>
      sql<ContentRevision>`SELECT * FROM puzzle_content_revisions WHERE game_id = ${gameId()} AND deleted_at IS NULL`
  );
  const library = createMemo<ContentLibrary>(() =>
    engine.paintReady()
      ? {
          documents: documents.rows(),
          drafts: drafts.rows().map(contentDraftOf),
          revisions: revisions.rows(),
        }
      : { documents: [], drafts: [], revisions: [] }
  );
  const isLoading = createMemo(
    () =>
      !engine.paintReady() ||
      documents.isLoading() ||
      drafts.isLoading() ||
      revisions.isLoading()
  );
  return { library, isLoading };
}

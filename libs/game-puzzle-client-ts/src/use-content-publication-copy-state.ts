import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useMutationFeedback } from '@pkgs/sync-engine-client-ts/use-mutation-feedback';
import { useContentLibraryState } from './content-library-context';
import { contentPublicationCopyState } from './content-publication-copy-state';
import type { ContentPublicationProps } from './use-content-publication';

/** This copy's receipt; the separate document-wide hook retains older refusals. */
export function useContentPublicationCopyState(props: ContentPublicationProps) {
  const library = useContentLibraryState();
  const engine = useSyncEngine();
  const feedback = useMutationFeedback('publishPuzzleContent', () => ({
    documentId: props.document.id,
    draftId: props.writer.draftId(),
  }));
  return () =>
    contentPublicationCopyState({
      document: props.document,
      draftId: props.writer.draftId(),
      dirty: props.writer.dirty(),
      feedback: library.isLoading() ? undefined : feedback(),
      revisions: library.content().revisions,
      online: engine.status().online,
    });
}

import {
  RefusedChangeCard,
  useRefusedChanges,
} from '@libs/app-env-client-ts/refused-change-notice';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useMutationFeedback } from '@pkgs/sync-engine-client-ts/use-mutation-feedback';
import { createMemo, type JSX, Show } from 'solid-js';
import type { ContentPublicationPending } from './content-publication-controls-view';

/**
 * The last publication of this draft, as it stays visible across routes and
 * app reopening: whether it is still on its way, and its refusal card.
 */
export function useContentPublicationStatus(documentId: () => string): {
  readonly pending: () => ContentPublicationPending;
  readonly refusal: () => JSX.Element;
} {
  const engine = useSyncEngine();
  const feedback = useMutationFeedback('publishPuzzleContent', () => ({
    documentId: documentId(),
  }));
  const changes = useRefusedChanges((name) => name === 'publishPuzzleContent');
  const refusal = createMemo(() =>
    changes
      .refusals()
      .find((entry) => entry.mutationId === feedback()?.mutationId)
  );
  return {
    pending: () => {
      if (feedback()?.status !== 'pending') return null;
      return engine.status().online ? 'online' : 'offline';
    },
    refusal: () => (
      <Show when={refusal()} keyed>
        {(entry) => (
          <RefusedChangeCard
            refusal={entry}
            onDismiss={() => changes.dismiss(entry)}
          />
        )}
      </Show>
    ),
  };
}

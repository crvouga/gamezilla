import { useRefusedChanges } from '@libs/app-env-client-ts/refused-change-notice';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useMutationFeedback } from '@pkgs/sync-engine-client-ts/use-mutation-feedback';
import type { JSX } from '@solidjs/web';
import { createMemo, Show } from 'solid-js';
import type { ContentPublicationPending } from './content-publication-controls-view';
import { ContentRefusalNotice } from './content-publication-refusal';

/** The first finding's code in a refusal's `{ issues }` meta, if any. */
function firstIssueCode(meta: string | null): string | null {
  if (meta === null) return null;
  try {
    const value: unknown = JSON.parse(meta);
    const issues: unknown =
      typeof value === 'object' && value !== null && 'issues' in value
        ? value.issues
        : null;
    const first: unknown = Array.isArray(issues) ? issues[0] : null;
    return typeof first === 'object' &&
      first !== null &&
      'code' in first &&
      typeof first.code === 'string'
      ? first.code
      : null;
  } catch {
    return null;
  }
}

/**
 * The last publication of this draft, as it stays visible across routes and
 * app reopening: whether it is still on its way, and its refusal card.
 */
export function useContentPublicationStatus(documentId: () => string): {
  readonly pending: () => ContentPublicationPending;
  readonly refusal: () => JSX.Element;
  /** The server refused the last publication and it is still in view. */
  readonly refused: () => boolean;
  /** The refusal's first finding, by its code; `null` when it names none. */
  readonly refusalIssue: () => string | null;
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
    refused: () => refusal() !== undefined,
    refusalIssue: () => firstIssueCode(refusal()?.meta ?? null),
    refusal: () => (
      <Show when={refusal()} keyed>
        {(entry) => (
          <ContentRefusalNotice
            refusal={entry}
            issue={firstIssueCode(entry.meta)}
            onDismiss={() => changes.dismiss(entry)}
          />
        )}
      </Show>
    ),
  };
}

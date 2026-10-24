import {
  RefusedChangeCard,
  useRefusedChanges,
} from '@libs/app-root-client-ts/refused-change-notice';
import { Trans } from '@lingui/solid/macro';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useMutationFeedback } from '@pkgs/sync-engine-client-ts/use-mutation-feedback';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { createMemo, type JSX, Show } from 'solid-js';

/** The last choice for this draft stays visible across routes and app reopening. */
export function ContentPublicationStatus(props: {
  documentId: string;
}): JSX.Element {
  const engine = useSyncEngine();
  const feedback = useMutationFeedback('publishPuzzleContent', () => ({
    documentId: props.documentId,
  }));
  const changes = useRefusedChanges((name) => name === 'publishPuzzleContent');
  const refusal = createMemo(() =>
    changes
      .refusals()
      .find((entry) => entry.mutationId === feedback()?.mutationId)
  );
  return (
    <>
      <Show when={feedback()?.status === 'pending'}>
        <Notice dataSet={{ testid: 'content-publication-pending' }}>
          <Show
            when={engine.status().online}
            fallback={
              <Trans>
                Publication waits for your connection. Your draft is kept on
                this device.
              </Trans>
            }
          >
            <Trans>
              Publication is waiting for confirmation. Your draft is kept. Keep
              this app connected to share it.
            </Trans>
          </Show>
        </Notice>
      </Show>
      <Show when={refusal()} keyed>
        {(entry) => (
          <RefusedChangeCard
            refusal={entry}
            onDismiss={() => changes.dismiss(entry)}
          />
        )}
      </Show>
    </>
  );
}

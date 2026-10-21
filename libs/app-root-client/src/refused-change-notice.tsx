/** @jsxImportSource solid-js */
/**
 * Top banner for a change that showed at once on this device and was then
 * refused, so the device undid it (a rename made offline under rules that
 * changed meanwhile, say). Without it the change would just quietly revert.
 * One refusal at a time, oldest first; dismissing it acknowledges it, here
 * and wherever it is kept, and the next one (if any) takes its place.
 */

import { Handles } from '@libs/test-ids-shared/handles';
import { useUnheardRefusals } from '@pkgs/sync-engine-client/use-unheard-refusals';
import { DismissibleBanner } from '@pkgs/ui-root-client/dismissible-top-banner';
import { createMemo, type JSX, Show } from 'solid-js';
import { refusedChangeDetail, refusedChangeTitle } from './refused-change-copy';

export function RefusedChangeNotice(): JSX.Element {
  const { refusals, acknowledge } = useUnheardRefusals();
  const first = createMemo(() => refusals()[0]);
  return (
    <Show when={first()} keyed>
      {(refusal) => (
        <DismissibleBanner
          visible
          onDismiss={() => void acknowledge(refusal)}
          position="top"
          tone="warning"
          title={refusedChangeTitle(refusal.mutationName)}
          subtitle={refusedChangeDetail(refusal.code)}
          dataSet={{
            testid: Handles.refusedChange,
            mutation: refusal.mutationName ?? '',
            code: refusal.code,
          }}
        />
      )}
    </Show>
  );
}

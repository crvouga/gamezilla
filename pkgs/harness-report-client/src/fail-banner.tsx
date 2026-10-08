import { useLingui } from '@lingui/solid/macro';
import type { FlatFrame } from '@pkgs/harness-report-shared/frames';
import { Button } from '@pkgs/ui-root-client/button';
import { DocumentPanel } from '@pkgs/ui-root-client/document-panel';
import { Notice } from '@pkgs/ui-root-client/notice';
import { Show } from 'solid-js';

/** Failure summary pinned above the stage, with a jump to the failed frame. */
export function FailBanner(props: {
  error: string | undefined;
  errorStack: string | undefined;
  failure: FlatFrame | null;
  onJump: (frame: FlatFrame) => void;
}) {
  const { t } = useLingui();
  const headline = () => (props.error ?? '').split('\n')[0] ?? '';
  return (
    <Show when={props.error || props.errorStack}>
      <Notice tone="error">
        <div class="box gap-3" role="alert">
          <div class="box flex-row flex-wrap items-center gap-3">
            <span class="text textLabel">{headline() || t`Test failed`}</span>
            <Show when={props.failure}>
              {(failure) => (
                <Button
                  title={t`Jump to failure`}
                  intent="danger"
                  variant="outline"
                  size="sm"
                  onClick={() => props.onJump(failure())}
                />
              )}
            </Show>
          </div>
          <Show when={props.errorStack}>
            {(stack) => (
              <details>
                <summary class="text textCaption clickableTint">{t`Stack trace`}</summary>
                <DocumentPanel content={stack()} title={t`Recorded failure`} />
              </details>
            )}
          </Show>
        </div>
      </Notice>
    </Show>
  );
}

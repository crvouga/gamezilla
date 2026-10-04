import type { FlatFrame } from '@pkgs/harness-report-shared/frames';
import { Show } from 'solid-js';

/** Failure summary pinned above the stage, with a jump to the failed frame. */
export function FailBanner(props: {
  error: string | undefined;
  errorStack: string | undefined;
  failure: FlatFrame | null;
  onJump: (frame: FlatFrame) => void;
}) {
  const headline = () => (props.error ?? '').split('\n')[0] ?? '';
  return (
    <Show when={props.error || props.errorStack}>
      <div class="sr-fail" role="alert">
        <div class="sr-fail-row">
          <span class="sr-dot failed" />
          <span class="msg">{headline() || 'Test failed'}</span>
          <Show when={props.failure}>
            {(f) => (
              <button
                type="button"
                class="sr-navbtn"
                title="Jump to failure (N)"
                onClick={() => props.onJump(f())}
              >
                Jump to failure
              </button>
            )}
          </Show>
        </div>
        <Show when={props.errorStack}>
          {(stack) => (
            <details>
              <summary>Stack trace</summary>
              <pre>{stack()}</pre>
            </details>
          )}
        </Show>
      </div>
    </Show>
  );
}

import { reportSolidBoundaryError } from './browser-boundaries';
/** @jsxImportSource solid-js */

import { reloadApp } from '@libs/app-root-shared/reload-app';
import { ErrorState } from '@pkgs/ui-root-client/error-state';
import { CircleAlertIcon } from '@pkgs/ui-root-client/icons';
import { ScrollView } from '@pkgs/ui-root-client/scroll-view';
import {
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  Show,
  untrack,
} from 'solid-js';
import { CrashCopyButton } from './crash-copy-button';

const CRASH_TITLE = 'Something went wrong';

type CrashScreenProps = {
  readonly error: Error;
  readonly reset: () => void;
  readonly copyError: (text: string) => Promise<void>;
};

function CrashDetails(props: {
  readonly message: string;
  readonly traceId: string | undefined;
}): JSX.Element {
  return (
    <details class="w-full min-w-0 border-t border-border pt-5">
      <summary class="text textBodyBold cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-focus-ring">
        Error details
      </summary>
      <div class="box gap-3 mt-3 p-4 rounded-xl bg-surface-sunken">
        <ScrollView
          class="max-h-48"
          flushEdge={false}
          role="region"
          tabindex="0"
          aria-label="Error message"
        >
          <pre class="text textMono m-0 break-words select-text">
            {props.message}
          </pre>
        </ScrollView>
        <Show when={props.traceId}>
          {(traceId) => (
            <p class="text textCaption break-all select-text">
              Trace: {traceId()}
            </p>
          )}
        </Show>
      </div>
    </details>
  );
}

function useCrashTrace(error: () => Error): () => string | undefined {
  const [traceId, setTraceId] = createSignal<string>();
  let mounted = true;
  onCleanup(() => {
    mounted = false;
  });
  onMount(() => {
    const exception = untrack(error);
    try {
      const id = reportSolidBoundaryError(exception);
      if (mounted && id !== undefined && !/^0+$/.test(id)) setTraceId(id);
    } catch {
      // Recovery must survive a failed telemetry report.
    }
  });
  return traceId;
}

export function CrashScreen(props: CrashScreenProps): JSX.Element {
  const traceId = useCrashTrace(() => props.error);
  const message = (): string =>
    props.error.message.trim() || String(props.error);
  const copyText = (): string =>
    [
      CRASH_TITLE,
      message(),
      props.error.stack,
      traceId() ? `Trace: ${traceId()}` : undefined,
    ]
      .filter(Boolean)
      .join('\n\n');
  return (
    <main
      class="box flex-1 min-h-0 overflow-auto bg-background"
      data-component="RootErrorBoundary"
    >
      <ErrorState
        icon={CircleAlertIcon}
        title={CRASH_TITLE}
        body="We couldn’t load this screen. Try again, or reload the app if the problem continues."
        retry={{ label: 'Try again', onClick: () => props.reset() }}
        secondary={{ label: 'Reload app', onClick: reloadApp }}
        details={
          <>
            <CrashDetails message={message()} traceId={traceId()} />
            <CrashCopyButton text={copyText()} copy={props.copyError} />
          </>
        }
      />
    </main>
  );
}

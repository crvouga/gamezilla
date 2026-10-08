import { reportSolidBoundaryError } from './browser-boundaries';
/** @jsxImportSource solid-js */

import { reloadApp } from '@libs/app-root-shared/reload-app';
import { Button } from '@pkgs/ui-root-client/button';
import {
  CircleAlertIcon,
  RefreshCwIcon,
  RotateCcwIcon,
} from '@pkgs/ui-root-client/icons';
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
          <pre class="m-0 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-text select-text">
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
      class="box flex-1 min-h-0 overflow-auto bg-background text-text p-6 sm:p-10"
      role="alert"
      data-component="RootErrorBoundary"
    >
      <section
        class="box w-full max-w-lg m-auto shrink-0 gap-6 p-6 sm:p-8 rounded-2xl border border-border bg-surface-elevated"
        aria-label="App recovery"
      >
        <div class="box w-14 h-14 items-center justify-center rounded-2xl bg-warning-surface">
          <CircleAlertIcon size={28} color="warning" />
        </div>
        <div class="box gap-3">
          <h1 class="text textHeading">{CRASH_TITLE}</h1>
          <p class="text leading-relaxed text-text-secondary">
            We couldn’t load this screen. Try again, or reload the app if the
            problem continues.
          </p>
        </div>
        <div class="box flex-row flex-wrap gap-3">
          <Button
            title="Try again"
            icon={RotateCcwIcon}
            onClick={() => props.reset()}
          />
          <Button
            title="Reload app"
            icon={RefreshCwIcon}
            intent="neutral"
            variant="outline"
            onClick={reloadApp}
          />
        </div>
        <CrashDetails message={message()} traceId={traceId()} />
        <CrashCopyButton text={copyText()} copy={props.copyError} />
      </section>
    </main>
  );
}

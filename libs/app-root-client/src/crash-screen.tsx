import { reportSolidBoundaryError } from './browser-boundaries';
/** @jsxImportSource solid-js */

import { reloadApp } from '@libs/app-root-shared/reload-app';
import { CodeBlock } from '@pkgs/ui-root-client/code-block';
import { Collapsible } from '@pkgs/ui-root-client/collapsible';
import { Divider } from '@pkgs/ui-root-client/divider';
import { ErrorState } from '@pkgs/ui-root-client/error-state';
import { CircleAlertIcon } from '@pkgs/ui-root-client/icons';
import { Main } from '@pkgs/ui-root-client/landmarks';
import { ScrollView } from '@pkgs/ui-root-client/scroll-view';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { Surface } from '@pkgs/ui-root-client/surface';
import { P } from '@pkgs/ui-root-client/text';
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
    <StackVertical width="full" gap="lg">
      <Divider />
      <Collapsible title="Error details">
        <Surface tone="muted" radius="card" padding="lg" gap="md">
          <ScrollView
            maxHeight="sm"
            flushEdge={false}
            role="region"
            tabIndex={0}
            aria-label="Error message"
          >
            <CodeBlock wrap framed={false}>
              {props.message}
            </CodeBlock>
          </ScrollView>
          <Show when={props.traceId}>
            {(traceId) => (
              <P variant="caption" wrap="break" selectable>
                Trace: {traceId()}
              </P>
            )}
          </Show>
        </Surface>
      </Collapsible>
    </StackVertical>
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
    <Main>
      <ScrollView
        grow
        tone="background"
        flushEdge={false}
        dataSet={{ component: 'RootErrorBoundary' }}
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
      </ScrollView>
    </Main>
  );
}

import { reportSolidBoundaryError } from './browser-boundaries';
/** @jsxImportSource solid-js */

import {
  APP_VERSION,
  getShortCommitHash,
  hasCommitProvenance,
} from '@libs/app-root-shared/app-metadata';
import { reloadApp } from '@libs/app-root-shared/reload-app';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { CodeBlock } from '@pkgs/ui-root-client/code-block';
import { Collapsible } from '@pkgs/ui-root-client/collapsible';
import { Divider } from '@pkgs/ui-root-client/divider';
import { ErrorState } from '@pkgs/ui-root-client/error-state';
import { CircleAlertIcon, RefreshCwIcon } from '@pkgs/ui-root-client/icons';
import { Main } from '@pkgs/ui-root-client/landmarks';
import { ScrollView } from '@pkgs/ui-root-client/scroll-view';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client/stack';
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

const BUTTON_ICON_SIZE = 16;

type CrashScreenProps = {
  readonly error: Error;
  readonly reset: () => void;
  /** Leave the crashed screen for Spaces; `reset` re-renders in place. */
  readonly goToSpaces: (reset: () => void) => void;
  readonly copyError: (text: string) => Promise<void>;
};

/** The version people and the team can match a report against. */
function buildVersion(): string {
  return hasCommitProvenance()
    ? `${APP_VERSION} (${getShortCommitHash()})`
    : APP_VERSION;
}

function CrashDetails(props: { readonly message: string }): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical width="full" gap="lg">
      <Divider />
      <Collapsible title={t`Error details`}>
        <Surface tone="muted" radius="card" padding="lg" gap="md">
          <ScrollView
            maxHeight="sm"
            flushEdge={false}
            role="region"
            tabIndex={0}
            aria-label={t`Error message`}
          >
            <CodeBlock wrap framed={false}>
              {props.message}
            </CodeBlock>
          </ScrollView>
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

/** Plain diagnostic text: what broke and how to find it. No stack, no URL. */
export function crashCopyText(args: {
  readonly title: string;
  readonly message: string;
  readonly reference: string | undefined;
}): string {
  return [
    args.title,
    args.message,
    args.reference === undefined ? undefined : `Reference: ${args.reference}`,
    `Version: ${buildVersion()}`,
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n\n');
}

export function CrashScreen(props: CrashScreenProps): JSX.Element {
  const { t } = useLingui();
  const traceId = useCrashTrace(() => props.error);
  const title = (): string => t`Something went wrong`;
  const message = (): string =>
    props.error.message.trim() || String(props.error);
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
          title={title()}
          body={t`This screen ran into a problem. Anything already saved on this device is kept. Try again, or go to Spaces.`}
          retry={{ label: t`Try again`, onClick: () => props.reset() }}
          secondary={{
            label: t`Go to Spaces`,
            onClick: () => props.goToSpaces(props.reset),
          }}
          details={
            <>
              <Show when={traceId()}>
                {(reference) => (
                  <P variant="caption" wrap="break" selectable>
                    <Trans>Reference: {reference()}</Trans>
                  </P>
                )}
              </Show>
              <StackHorizontal wrap align="start" gap="sm">
                <Button
                  title={t`Reload app`}
                  intent="neutral"
                  variant="ghost"
                  startIcon={<RefreshCwIcon size={BUTTON_ICON_SIZE} />}
                  onClick={reloadApp}
                />
                <CrashCopyButton
                  text={crashCopyText({
                    title: title(),
                    message: message(),
                    reference: traceId(),
                  })}
                  copy={props.copyError}
                />
              </StackHorizontal>
              <CrashDetails message={message()} />
            </>
          }
        />
      </ScrollView>
    </Main>
  );
}

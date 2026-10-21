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
import { ErrorState } from '@pkgs/ui-root-client/error-state';
import { CircleAlertIcon, RefreshCwIcon } from '@pkgs/ui-root-client/icons';
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
    <details class="w-full min-w-0 border-t border-border pt-5">
      <summary class="text textBodyBold cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-focus-ring">
        <Trans>Error details</Trans>
      </summary>
      <div class="box gap-3 mt-3 p-4 rounded-xl bg-surface-sunken">
        <ScrollView
          class="max-h-48"
          flushEdge={false}
          role="region"
          tabindex="0"
          aria-label={t`Error message`}
        >
          <pre class="text textMono m-0 break-words select-text">
            {props.message}
          </pre>
        </ScrollView>
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
    <main
      class="box flex-1 min-h-0 overflow-auto bg-background"
      data-component="RootErrorBoundary"
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
                <p class="text textCaption break-all select-text">
                  <Trans>Reference: {reference()}</Trans>
                </p>
              )}
            </Show>
            <div class="box flex-row flex-wrap items-start gap-2">
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
            </div>
            <CrashDetails message={message()} />
          </>
        }
      />
    </main>
  );
}

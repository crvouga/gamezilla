/** @jsxImportSource solid-js */

import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CodeBlock } from '@pkgs/ui-root-client-ts/code-block';
import { Collapsible } from '@pkgs/ui-root-client-ts/collapsible';
import { Divider } from '@pkgs/ui-root-client-ts/divider';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import {
  BugIcon,
  CircleAlertIcon,
  RefreshCwIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { Main } from '@pkgs/ui-root-client-ts/landmarks';
import { ScrollView } from '@pkgs/ui-root-client-ts/scroll-view';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import { CrashCopyButton, type CrashCopyPhase } from './crash-copy-button';

const BUTTON_ICON_SIZE = 16;

export type CrashScreenViewProps = {
  /** What broke, in plain text (no stack). */
  readonly message: string;
  /** Telemetry reference people and the team can match, once reported. */
  readonly reference?: string | undefined;
  readonly copyPhase: CrashCopyPhase;
  /** Re-render the crashed screen in place. */
  readonly onTryAgain: () => void;
  /** Leave the crashed screen for Spaces. */
  readonly onGoToSpaces: () => void;
  readonly onReload: () => void;
  readonly onCopy: () => void;
  /** Open a bug report: a crash is when a person most needs one. */
  readonly onReportBug: () => void;
};

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

/** The crash screen's headline, shared with the copied diagnostic text. */
export function useCrashTitle(): () => string {
  const { t } = useLingui();
  return () => t`Something went wrong`;
}

/**
 * The root error boundary's recovery screen, presentational: what happened,
 * Try again / Go to Spaces, a reference, reload, copy and report a bug, and the error
 * details behind a disclosure. `CrashScreen` reports the error and copies.
 */
export function CrashScreenView(props: CrashScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const title = useCrashTitle();
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
          retry={{ label: t`Try again`, onClick: () => props.onTryAgain() }}
          secondary={{
            label: t`Go to Spaces`,
            onClick: () => props.onGoToSpaces(),
          }}
          details={
            <>
              <Show when={props.reference}>
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
                  onClick={() => props.onReload()}
                />
                <CrashCopyButton
                  phase={props.copyPhase}
                  onCopy={props.onCopy}
                />
                <Button
                  title={t`Report a bug`}
                  intent="neutral"
                  variant="ghost"
                  startIcon={<BugIcon size={BUTTON_ICON_SIZE} />}
                  onClick={() => props.onReportBug()}
                />
              </StackHorizontal>
              <CrashDetails message={props.message} />
            </>
          }
        />
      </ScrollView>
    </Main>
  );
}

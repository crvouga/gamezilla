import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { type JSX, Show } from 'solid-js';
import { PuzzleImportStatus } from './puzzle-import-status';
import { PuzzleImportStop } from './puzzle-import-stop';
import {
  PuzzleSourceControls,
  type PuzzleSourceControlsProps,
} from './puzzle-source-controls';
import type { PuzzleImportRow } from './use-puzzle-import';

export type PuzzleManagementScreenViewProps = PuzzleSourceControlsProps & {
  /** Inside the developer console instead of Settings. */
  readonly embedded?: boolean | undefined;
  /** Set for anyone outside the puzzle team; replaces the controls. */
  readonly denial?: DenialView | undefined;
  /** The load status subscription has its first answer. */
  readonly ready: boolean;
  /** The latest load, once known. */
  readonly job: PuzzleImportRow | null;
  readonly onStart: () => Promise<void>;
  readonly onStop: () => Promise<void>;
};

function ManagementContent(
  props: PuzzleManagementScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  const running = () => props.uploading || props.job?.status === 'adding';
  const start = useMutationButton({
    operation: () => props.onStart(),
    get disabled() {
      return (
        props.source.filename === null ||
        props.source.loading ||
        !props.ready ||
        !props.online ||
        running()
      );
    },
    labels: {
      idle: t`Start loading`,
      loading: t`Starting load…`,
      success: t`Load started`,
      error: t`Try loading again`,
    },
  });
  return (
    <>
      <MenuSection>
        <MenuRow
          title={<Trans>Available puzzles</Trans>}
          value={props.job?.pool_rows ?? '—'}
          dataSet={{ testid: 'puzzle-load-pool' }}
        />
      </MenuSection>
      <PuzzleSourceControls {...props} />
      <Show when={!props.ready}>
        <LoadingState
          variant="compact"
          caption={<Trans>Connecting to puzzle status…</Trans>}
        />
      </Show>
      <Show when={!props.online}>
        <Notice dataSet={{ testid: 'puzzle-load-offline' }}>
          <Trans>
            You are offline. The last status is shown. Reconnect to check or
            save a Lichess file, start loading, or stop loading.
          </Trans>
        </Notice>
      </Show>
      <Show when={start.error()} keyed>
        {(error) => <Notice tone="error">{error.message}</Notice>}
      </Show>
      <StackHorizontal wrap gap="md">
        <Button
          {...start.buttonProps}
          dataSet={{ testid: 'puzzle-load-start' }}
        />
        <PuzzleImportStop
          running={running()}
          uploading={props.uploading}
          online={props.online}
          jobStatus={props.job?.status ?? null}
          onStop={props.onStop}
        />
      </StackHorizontal>
      <Show when={props.job} keyed>
        {(job) => <PuzzleImportStatus job={job} />}
      </Show>
      <Notice>
        <Trans>
          Loading continues in the background. The saved file stays available.
          You can return here to follow its progress or stop it.
        </Trans>
      </Notice>
    </>
  );
}

function ManagementBody(props: PuzzleManagementScreenViewProps): JSX.Element {
  return (
    <StackVertical gap="lg" testId="puzzle-load-content">
      <Show when={props.denial} fallback={<ManagementContent {...props} />}>
        {(denial) => <DenialSurfaceView denial={denial()} variant="compact" />}
      </Show>
    </StackVertical>
  );
}

/**
 * `/more/puzzles`, presentational: the puzzle team's chess puzzle loader —
 * the pool size, the saved Lichess file or an upload of one, starting and
 * stopping a load, and the latest load's progress — or the denial for
 * everyone else. `PuzzleManagementScreen` wires it to storage and sync.
 */
export function PuzzleManagementScreenView(
  props: PuzzleManagementScreenViewProps
): JSX.Element {
  return (
    <Show
      when={props.embedded}
      fallback={
        <ContentScreen
          screenId="puzzle-management"
          breadcrumbs={[
            { name: <Trans>Settings</Trans>, href: '/more' },
            { name: <Trans>Load chess puzzles</Trans> },
          ]}
        >
          <ManagementBody {...props} />
        </ContentScreen>
      }
    >
      <EmbeddedScreen
        screenId="puzzle-management"
        title={<Trans>Load chess puzzles</Trans>}
        subtitle={
          <Trans>
            Upload a missing Lichess file, then load its puzzles into this
            environment.
          </Trans>
        }
      >
        <ManagementBody {...props} />
      </EmbeddedScreen>
    </Show>
  );
}

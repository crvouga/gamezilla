import { DenialSurface } from '@libs/permissions-client-ts/denial-surface';
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
import { PuzzleSourceControls } from './puzzle-source-controls';
import { usePuzzleImport } from './use-puzzle-import';

function PuzzleManagementContent(): JSX.Element {
  const { t } = useLingui();
  const state = usePuzzleImport();
  const running = () => state.uploading() || state.job()?.status === 'adding';
  const start = useMutationButton({
    operation: state.start,
    get disabled() {
      return (
        !state.source.source() ||
        state.source.loading() ||
        !state.ready() ||
        !state.connection.status().online ||
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
    <StackVertical gap="lg" testId="puzzle-load-content">
      <Show
        when={state.decision().allowed}
        fallback={
          <DenialSurface decision={state.decision()} variant="compact" />
        }
      >
        <MenuSection>
          <MenuRow
            title={<Trans>Available puzzles</Trans>}
            value={state.job()?.pool_rows ?? '—'}
            dataSet={{ testid: 'puzzle-load-pool' }}
          />
        </MenuSection>
        <PuzzleSourceControls state={state} />
        <Show when={!state.ready()}>
          <LoadingState
            variant="compact"
            caption={<Trans>Connecting to puzzle status…</Trans>}
          />
        </Show>
        <Show when={!state.connection.status().online}>
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
          <PuzzleImportStop state={state} running={running()} />
        </StackHorizontal>
        <Show when={state.job()} keyed>
          {(job) => <PuzzleImportStatus job={job} />}
        </Show>
        <Notice>
          <Trans>
            Loading continues in the background. The saved file stays available.
            You can return here to follow its progress or stop it.
          </Trans>
        </Notice>
      </Show>
    </StackVertical>
  );
}

export function PuzzleManagementScreen(props: {
  embedded?: boolean;
}): JSX.Element {
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
          <PuzzleManagementContent />
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
        <PuzzleManagementContent />
      </EmbeddedScreen>
    </Show>
  );
}

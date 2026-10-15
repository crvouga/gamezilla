import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { ContentScreen } from '@pkgs/ui-root-client/content-screen';
import { EmbeddedScreen } from '@pkgs/ui-root-client/embedded-screen';
import { FilePicker } from '@pkgs/ui-root-client/file-picker';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MutationModal } from '@pkgs/ui-root-client/mutation-modal';
import { Notice } from '@pkgs/ui-root-client/notice';
import { useMutationButton } from '@pkgs/ui-root-client/use-mutation-button';
import { createSignal, type JSX, Show } from 'solid-js';
import { PuzzleImportStatus } from './puzzle-import-status';
import { usePuzzleImport } from './use-puzzle-import';

function PuzzleManagementContent(): JSX.Element {
  const { t } = useLingui();
  const state = usePuzzleImport();
  const [confirming, setConfirming] = createSignal(false);
  const running = () => state.uploading() || state.job()?.status === 'adding';
  const start = useMutationButton({
    operation: state.start,
    get disabled() {
      return (
        !state.file() ||
        !state.ready() ||
        !state.connection.status().online ||
        running()
      );
    },
    labels: {
      idle: t`Start loading`,
      loading: t`Uploading CSV…`,
      success: t`Load started`,
      error: t`Try loading again`,
    },
  });
  return (
    <div class="box gap-4" data-testid="puzzle-load-content">
      <Show
        when={state.decision().allowed}
        fallback={
          <DenialSurface decision={state.decision()} variant="compact" />
        }
      >
        <MenuRow
          title={<Trans>Available puzzles</Trans>}
          value={state.job()?.pool_rows ?? '—'}
          dataSet={{ testid: 'puzzle-load-pool' }}
        />
        <Notice>
          <Trans>
            Choose the Lichess puzzle database CSV or its .csv.zst archive.
            Existing puzzle IDs are updated; broken puzzles and duplicate
            positions are skipped. Your players' progress is kept.
          </Trans>
        </Notice>
        <Show when={!state.ready()}>
          <LoadingState
            variant="compact"
            caption={<Trans>Connecting to puzzle status…</Trans>}
          />
        </Show>
        <Show when={!state.connection.status().online}>
          <Notice dataSet={{ testid: 'puzzle-load-offline' }}>
            <Trans>
              You are offline. The last status is shown. Reconnect to start or
              stop loading.
            </Trans>
          </Notice>
        </Show>
        <FilePicker
          label={<Trans>Lichess puzzle database</Trans>}
          accept=".csv,.csv.zst,.zst,text/csv"
          disabled={running()}
          onSelect={state.setFile}
          dataSet={{ testid: 'puzzle-load-file' }}
        />
        <Show when={state.uploading()}>
          <div role="status">
            <Notice>
              <Trans>
                Uploaded {state.uploadedRows()} puzzles. Keep this screen open
                until the upload finishes.
              </Trans>
            </Notice>
          </div>
        </Show>
        <Show when={start.error()} keyed>
          {(error) => <Notice tone="error">{error.message}</Notice>}
        </Show>
        <div class="box flex-row flex-wrap gap-3">
          <Button
            {...start.buttonProps}
            dataSet={{ testid: 'puzzle-load-start' }}
          />
          <Show when={running()}>
            <Button
              title={t`Stop loading`}
              disabled={!state.connection.status().online && !state.uploading()}
              intent="danger"
              variant="outline"
              onClick={() => setConfirming(true)}
              dataSet={{ testid: 'puzzle-load-stop' }}
            />
          </Show>
        </div>
        <Show when={state.job()} keyed>
          {(job) => <PuzzleImportStatus job={job} />}
        </Show>
        <Notice>
          <Trans>
            After the upload finishes, loading continues in the background. You
            can return here to follow its progress or stop it.
          </Trans>
        </Notice>
        <MutationModal
          visible={confirming()}
          onClose={() => setConfirming(false)}
          title={t`Stop loading puzzles?`}
          message={t`Puzzles already added or updated stay available. No more batches will be added after stopping.`}
          operation={state.stop}
          submitLabel={t`Stop loading`}
          variant="destructive"
          successTitle={t`Puzzle loading stopped`}
          submitDataSet={{ testid: 'puzzle-load-stop-confirm' }}
        />
      </Show>
    </div>
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
            Add or update this environment's puzzles from the Lichess database.
          </Trans>
        }
      >
        <PuzzleManagementContent />
      </EmbeddedScreen>
    </Show>
  );
}

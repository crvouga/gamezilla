import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { FilePicker } from '@pkgs/ui-root-client/file-picker';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { Notice } from '@pkgs/ui-root-client/notice';
import { useMutationButton } from '@pkgs/ui-root-client/use-mutation-button';
import { Show } from 'solid-js';
import type { usePuzzleImport } from './use-puzzle-import';

export function PuzzleSourceControls(props: {
  state: ReturnType<typeof usePuzzleImport>;
}) {
  const { t } = useLingui();
  const save = useMutationButton({
    operation: props.state.save,
    get disabled() {
      return (
        !props.state.file() ||
        props.state.uploading() ||
        !props.state.connection.status().online
      );
    },
    labels: {
      idle: t`Save Lichess file`,
      loading: t`Saving Lichess file…`,
      success: t`Lichess file saved`,
      error: t`Try saving again`,
    },
  });
  return (
    <>
      <Show when={props.state.source.loading()}>
        <LoadingState
          variant="compact"
          caption={<Trans>Checking for the saved Lichess file…</Trans>}
        />
      </Show>
      <Show when={props.state.source.error()} keyed>
        {(error) => (
          <>
            <Notice tone="error">{error.message}</Notice>
            <Button
              title={t`Check saved file again`}
              variant="outline"
              onClick={props.state.source.reload}
            />
          </>
        )}
      </Show>
      <Show when={props.state.source.source()} keyed>
        {(source) => (
          <>
            <MenuRow
              title={<Trans>Saved Lichess file</Trans>}
              value={source.filename}
              dataSet={{ testid: 'puzzle-source-saved' }}
            />
            <Notice>
              <Trans>
                Load the saved file into this environment. The same file is
                available to every environment.
              </Trans>
            </Notice>
          </>
        )}
      </Show>
      <Show
        when={
          props.state.source.known() &&
          !props.state.source.source() &&
          !props.state.source.error()
        }
      >
        <Notice dataSet={{ testid: 'puzzle-source-missing' }}>
          <Trans>
            No Lichess file has been saved yet. Choose the database CSV or its
            .csv.zst archive once to make it available to every environment.
          </Trans>
        </Notice>
        <FilePicker
          label={<Trans>Lichess puzzle database</Trans>}
          accept=".csv,.csv.zst,.zst,text/csv"
          disabled={props.state.uploading()}
          onSelect={props.state.setFile}
          dataSet={{ testid: 'puzzle-load-file' }}
        />
        <Button
          {...save.buttonProps}
          dataSet={{ testid: 'puzzle-source-save' }}
        />
        <Show when={save.error()} keyed>
          {(error) => <Notice tone="error">{error.message}</Notice>}
        </Show>
      </Show>
      <Show when={props.state.uploading()}>
        <div role="status">
          <Notice>
            <Trans>
              Saved {props.state.uploadedRows()} puzzles. Keep this screen open
              until the file finishes saving.
            </Trans>
          </Notice>
        </div>
      </Show>
    </>
  );
}

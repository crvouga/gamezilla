import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { FilePicker } from '@pkgs/ui-root-client/file-picker';
import { LinearProgress } from '@pkgs/ui-root-client/linear-progress';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { Notice } from '@pkgs/ui-root-client/notice';
import { useMutationButton } from '@pkgs/ui-root-client/use-mutation-button';
import { createEffect, on, Show } from 'solid-js';
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
      idle: t`Upload Lichess file`,
      loading: t`Uploading Lichess file…`,
      success: t`Lichess file uploaded`,
      error: t`Try uploading again`,
    },
  });
  createEffect(on(props.state.file, () => save.reset(), { defer: true }));
  return (
    <>
      <Show
        when={
          !props.state.connection.status().online &&
          !props.state.source.known() &&
          !props.state.source.error()
        }
      >
        <Notice dataSet={{ testid: 'puzzle-source-check-offline' }}>
          <Trans>
            A connection is needed to check for the saved Lichess file.
          </Trans>
        </Notice>
      </Show>
      <Show when={props.state.source.loading()}>
        <LoadingState
          dataSet={{ testid: 'puzzle-source-checking' }}
          variant="compact"
          caption={<Trans>Checking for the saved Lichess file…</Trans>}
        />
      </Show>
      <Show when={props.state.source.error()} keyed>
        {(error) => (
          <Notice tone="error" dataSet={{ testid: 'puzzle-source-error' }}>
            {error.message}
          </Notice>
        )}
      </Show>
      <Show when={props.state.source.error() || props.state.source.known()}>
        <Button
          dataSet={{ testid: 'puzzle-source-recheck' }}
          title={t`Check saved file again`}
          variant="outline"
          disabled={
            props.state.source.loading() ||
            props.state.uploading() ||
            !props.state.connection.status().online
          }
          onClick={props.state.source.reload}
        />
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
                The Lichess file is in the shared bucket. Start loading to add
                its puzzles to this environment.
              </Trans>
            </Notice>
          </>
        )}
      </Show>
      <Show
        when={
          props.state.source.known() &&
          !props.state.source.loading() &&
          !props.state.source.source() &&
          !props.state.source.error()
        }
      >
        <Show when={!props.state.uploading()}>
          <Notice dataSet={{ testid: 'puzzle-source-missing' }}>
            <Trans>
              No Lichess file is in the shared bucket. Choose a .csv or .csv.zst
              file to upload. Once uploaded, start loading to add its puzzles to
              this environment.
            </Trans>
          </Notice>
        </Show>
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
      </Show>
      <Show when={props.state.file() && !props.state.source.source()}>
        <MenuRow
          title={<Trans>Chosen Lichess file</Trans>}
          value={props.state.file()?.name}
          dataSet={{ testid: 'puzzle-source-chosen' }}
        />
      </Show>
      <Show when={save.error()} keyed>
        {(error) => (
          <Notice tone="error" dataSet={{ testid: 'puzzle-source-save-error' }}>
            {error.message}
          </Notice>
        )}
      </Show>
      <Show when={props.state.uploading()}>
        <div role="status" data-testid="puzzle-source-saving">
          <LinearProgress
            label={t`Uploading Lichess file`}
            progress={props.state.uploadProgress()}
            dataSet={{ testid: 'puzzle-source-progress' }}
            description={
              <Trans>
                Uploaded {props.state.uploadedRows()} puzzles to the shared
                bucket. Keep this screen open until the upload finishes.
              </Trans>
            }
          />
        </div>
      </Show>
    </>
  );
}

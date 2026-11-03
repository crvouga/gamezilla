import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { FilePicker } from '@pkgs/ui-root-client-ts/file-picker';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { ProgressBar } from '@pkgs/ui-root-client-ts/progress-bar';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { createEffect, on, Show } from 'solid-js';

/** What is known of the Lichess file saved in the shared bucket. */
export type PuzzleSavedSourceView = {
  /** The last check finished (found or not). */
  readonly known: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  /** The saved file's name; null when none is saved. */
  readonly filename: string | null;
};

export type PuzzleSourceControlsProps = {
  readonly online: boolean;
  readonly source: PuzzleSavedSourceView;
  /** The file chosen to upload, when none is saved yet. */
  readonly chosenFile: { readonly name: string } | null;
  readonly uploading: boolean;
  readonly uploadProgress: number;
  readonly uploadedRows: number;
  readonly onSelectFile: (file: File | null) => void;
  readonly onSave: () => Promise<void>;
  readonly onRecheck: () => void;
};

/** Check for the saved Lichess file, or choose and upload one. */
export function PuzzleSourceControls(props: PuzzleSourceControlsProps) {
  const { t } = useLingui();
  const save = useMutationButton({
    operation: () => props.onSave(),
    get disabled() {
      return props.chosenFile === null || props.uploading || !props.online;
    },
    labels: {
      idle: t`Upload Lichess file`,
      loading: t`Uploading Lichess file…`,
      success: t`Lichess file uploaded`,
      error: t`Try uploading again`,
    },
  });
  createEffect(
    on(
      () => props.chosenFile,
      () => save.reset(),
      { defer: true }
    )
  );
  return (
    <>
      <Show
        when={
          !props.online && !props.source.known && props.source.error === null
        }
      >
        <Notice dataSet={{ testid: 'puzzle-source-check-offline' }}>
          <Trans>
            A connection is needed to check for the saved Lichess file.
          </Trans>
        </Notice>
      </Show>
      <Show when={props.source.loading}>
        <LoadingState
          dataSet={{ testid: 'puzzle-source-checking' }}
          variant="compact"
          caption={<Trans>Checking for the saved Lichess file…</Trans>}
        />
      </Show>
      <Show when={props.source.error} keyed>
        {(error) => (
          <Notice tone="error" dataSet={{ testid: 'puzzle-source-error' }}>
            {error}
          </Notice>
        )}
      </Show>
      <Show when={props.source.error !== null || props.source.known}>
        <Button
          dataSet={{ testid: 'puzzle-source-recheck' }}
          title={t`Check saved file again`}
          variant="outline"
          disabled={props.source.loading || props.uploading || !props.online}
          onClick={() => props.onRecheck()}
        />
      </Show>
      <Show when={props.source.filename} keyed>
        {(filename) => (
          <>
            <MenuRow
              title={<Trans>Saved Lichess file</Trans>}
              value={filename}
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
          props.source.known &&
          !props.source.loading &&
          props.source.filename === null &&
          props.source.error === null
        }
      >
        <Show when={!props.uploading}>
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
          disabled={props.uploading}
          onSelect={(file) => props.onSelectFile(file)}
          dataSet={{ testid: 'puzzle-load-file' }}
        />
        <Button
          {...save.buttonProps}
          dataSet={{ testid: 'puzzle-source-save' }}
        />
      </Show>
      <Show when={props.chosenFile !== null && props.source.filename === null}>
        <MenuRow
          title={<Trans>Chosen Lichess file</Trans>}
          value={props.chosenFile?.name}
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
      <Show when={props.uploading}>
        <StackVertical role="status" testId="puzzle-source-saving">
          <ProgressBar
            label={t`Uploading Lichess file`}
            progress={props.uploadProgress}
            dataSet={{ testid: 'puzzle-source-progress' }}
            description={
              <Trans>
                Uploaded {props.uploadedRows} puzzles to the shared bucket. Keep
                this screen open until the upload finishes.
              </Trans>
            }
          />
        </StackVertical>
      </Show>
    </>
  );
}

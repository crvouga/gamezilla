import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { MutationModal } from '@pkgs/ui-root-client/mutation-modal';
import { createEffect, createSignal, Show } from 'solid-js';
import type { usePuzzleImport } from './use-puzzle-import';

export function PuzzleImportStop(props: {
  state: ReturnType<typeof usePuzzleImport>;
  running: boolean;
}) {
  const { t } = useLingui();
  const [confirming, setConfirming] = createSignal(false);
  const [savingFile, setSavingFile] = createSignal(false);
  const [submitted, setSubmitted] = createSignal(false);
  createEffect(() => {
    if (
      confirming() &&
      savingFile() &&
      !submitted() &&
      !props.state.uploading()
    )
      setConfirming(false);
  });
  const ask = () => {
    setSavingFile(props.state.uploading());
    setSubmitted(false);
    setConfirming(true);
  };
  return (
    <>
      <Show when={props.running}>
        <Button
          title={
            props.state.uploading() ? t`Stop saving file` : t`Stop loading`
          }
          disabled={
            !props.state.connection.status().online && !props.state.uploading()
          }
          intent="danger"
          variant="outline"
          onClick={ask}
          dataSet={{ testid: 'puzzle-load-stop' }}
        />
      </Show>
      <MutationModal
        dataSet={{ testid: 'puzzle-load-stop-modal' }}
        cancelDataSet={{ testid: 'puzzle-load-stop-cancel' }}
        successDataSet={{ testid: 'puzzle-load-stop-success' }}
        visible={confirming()}
        onClose={() => setConfirming(false)}
        title={
          savingFile()
            ? t`Stop saving the Lichess file?`
            : t`Stop loading puzzles?`
        }
        message={
          savingFile()
            ? t`The unfinished file will not become available. You can save the chosen file again.`
            : t`Puzzles already added or updated stay available. No more batches will be added after stopping.`
        }
        operation={async () => {
          setSubmitted(true);
          await props.state.stop();
        }}
        submitLabel={savingFile() ? t`Stop saving` : t`Stop loading`}
        submitDisabled={
          !props.state.connection.status().online && !savingFile()
        }
        variant="destructive"
        successTitle={
          savingFile()
            ? t`Saving stopped`
            : props.state.job()?.status === 'finished'
              ? t`Loading already finished`
              : props.state.job()?.status === 'failed'
                ? t`Loading already failed`
                : t`Puzzle loading stopped`
        }
        submitDataSet={{ testid: 'puzzle-load-stop-confirm' }}
      />
    </>
  );
}

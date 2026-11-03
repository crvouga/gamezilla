import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { createEffect, createSignal, Show } from 'solid-js';

/** Stop the file upload or the load, after a destructive confirm. */
export function PuzzleImportStop(props: {
  running: boolean;
  uploading: boolean;
  online: boolean;
  /** The latest load's status, to say how stopping ended. */
  jobStatus: string | null;
  onStop: () => Promise<void>;
}) {
  const { t } = useLingui();
  const [confirming, setConfirming] = createSignal(false);
  const [savingFile, setSavingFile] = createSignal(false);
  const [submitted, setSubmitted] = createSignal(false);
  createEffect(() => {
    if (confirming() && savingFile() && !submitted() && !props.uploading)
      setConfirming(false);
  });
  const ask = () => {
    setSavingFile(props.uploading);
    setSubmitted(false);
    setConfirming(true);
  };
  return (
    <>
      <Show when={props.running}>
        <Button
          title={props.uploading ? t`Stop saving file` : t`Stop loading`}
          disabled={!props.online && !props.uploading}
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
          await props.onStop();
        }}
        submitLabel={savingFile() ? t`Stop saving` : t`Stop loading`}
        submitDisabled={!props.online && !savingFile()}
        variant="destructive"
        successTitle={
          savingFile()
            ? t`Saving stopped`
            : props.jobStatus === 'finished'
              ? t`Loading already finished`
              : props.jobStatus === 'failed'
                ? t`Loading already failed`
                : t`Puzzle loading stopped`
        }
        submitDataSet={{ testid: 'puzzle-load-stop-confirm' }}
      />
    </>
  );
}

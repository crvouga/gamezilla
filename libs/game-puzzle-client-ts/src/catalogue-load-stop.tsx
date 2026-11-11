import { useLingui } from '@lingui/solid/macro';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { createEffect, createSignal, type JSX, on } from 'solid-js';
import type { CatalogueLoadJobStatus } from './catalogue-load-places';
import type { CatalogueLoadStopKind } from './catalogue-load-view';

export type CatalogueLoadStopProps = {
  /** The stop being asked; `null` while none is. */
  readonly asked: CatalogueLoadStopKind | null;
  readonly onClose: () => void;
  /** The upload is still under way. */
  readonly uploading: boolean;
  readonly online: boolean;
  /** The latest load's status, to say how stopping ended. */
  readonly jobStatus: CatalogueLoadJobStatus | null;
  readonly sourceName: string;
  readonly onStop: () => Promise<void>;
};

/**
 * The loader's destructive confirm, owned by its shell so it survives the
 * place under it changing: stop saving the file, or stop the load. A save
 * that ends on its own before the person confirms closes the question.
 */
export function CatalogueLoadStop(props: CatalogueLoadStopProps): JSX.Element {
  const { t } = useLingui();
  // What was asked last: the dialog keeps its words while it closes.
  const [kind, setKind] = createSignal<CatalogueLoadStopKind>('loading');
  const [submitted, setSubmitted] = createSignal(false);
  createEffect(
    on(
      () => props.asked,
      (asked) => {
        if (asked === null) return;
        setKind(asked);
        setSubmitted(false);
      }
    )
  );
  createEffect(() => {
    if (props.asked === 'saving' && !submitted() && !props.uploading)
      props.onClose();
  });
  const saving = (): boolean => kind() === 'saving';
  const stopped = (): string => {
    if (saving()) return t`Saving stopped`;
    if (props.jobStatus === 'finished') return t`Loading already finished`;
    if (props.jobStatus === 'failed') return t`Loading already failed`;
    return t`Puzzle loading stopped`;
  };
  return (
    <MutationModal
      dataSet={{ testid: 'puzzle-load-stop-modal' }}
      cancelDataSet={{ testid: 'puzzle-load-stop-cancel' }}
      successDataSet={{ testid: 'puzzle-load-stop-success' }}
      submitDataSet={{ testid: 'puzzle-load-stop-confirm' }}
      visible={props.asked !== null}
      onClose={() => props.onClose()}
      title={
        saving()
          ? t`Stop saving the ${props.sourceName}?`
          : t`Stop loading puzzles?`
      }
      message={
        saving()
          ? t`The unfinished file will not become available. You can save the chosen file again.`
          : t`Puzzles already added or updated stay available. No more batches will be added after stopping.`
      }
      operation={async () => {
        setSubmitted(true);
        await props.onStop();
      }}
      submitLabel={saving() ? t`Stop saving` : t`Stop loading`}
      submitDisabled={!props.online && !saving()}
      variant="destructive"
      successTitle={stopped()}
    />
  );
}

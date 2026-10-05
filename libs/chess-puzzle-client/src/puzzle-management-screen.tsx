import type { PuzzleLoadJob } from '@libs/chess-puzzle-shared/puzzle-load-job';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import { MutationModal } from '@pkgs/ui-root-client/mutation-modal';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import { createSignal, type JSX, onMount, Show } from 'solid-js';
import { usePuzzleManagementApi } from './puzzle-management-api';

function JobResult(props: { readonly job: PuzzleLoadJob }): JSX.Element {
  return (
    <div class="box gap-2" role="status" data-testid="puzzle-load-result">
      <p class="text">
        <Trans>Status: {props.job.status}</Trans>
      </p>
      <p class="text">
        <Trans>
          Processed {props.job.processedRows}; added {props.job.insertedRows};
          rejected {props.job.failedRows}.
        </Trans>
      </p>
      <Show when={props.job.error !== null}>
        <p class="text text-destructive">{props.job.error}</p>
      </Show>
    </div>
  );
}

export function PuzzleManagementScreen(): JSX.Element {
  const { t } = useLingui();
  const api = usePuzzleManagementApi();
  const [job, setJob] = createSignal<PuzzleLoadJob | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [loadError, setLoadError] = createSignal<string | null>(null);
  const [confirming, setConfirming] = createSignal(false);
  onMount(() => {
    void api
      .latest()
      .then(setJob)
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setLoading(false));
  });
  const start = async (): Promise<void> => {
    const result = await api.start();
    setJob(result);
    if (result.status === 'failed') {
      throw new Error(result.error ?? t`Adding puzzles failed`);
    }
  };
  return (
    <ScreenBase
      screenId="puzzle-management"
      scroll
      breadcrumbs={[
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Puzzles</Trans> },
      ]}
      content={() => (
        <div class="box gap-4">
          <p class="text">
            <Trans>
              Add every puzzle in chess/puzzles.ndjson from this environment's
              object store. PostgreSQL validates and adds the rows in batches.
            </Trans>
          </p>
          <Show when={loading()}>
            <p class="text" role="status">
              <Trans>Reading the latest result…</Trans>
            </p>
          </Show>
          <Show when={loadError()} keyed>
            {(message) => <p class="text text-destructive">{message}</p>}
          </Show>
          <Show when={job()} keyed>
            {(value) => <JobResult job={value} />}
          </Show>
          <Button
            title={t`Add puzzles`}
            disabled={job()?.status === 'adding'}
            onClick={() => setConfirming(true)}
            dataSet={{ testid: 'puzzle-load-review' }}
          />
          <MutationModal
            visible={confirming()}
            onClose={() => setConfirming(false)}
            title={t`Add puzzles to this environment?`}
            message={t`The current environment's object is processed into its puzzle pool. Existing puzzles are kept.`}
            operation={start}
            submitLabel={t`Add puzzles`}
            successTitle={t`Puzzle load finished`}
            successBody={t`The latest PostgreSQL result is shown on this screen.`}
            submitDataSet={{ testid: 'puzzle-load-confirm' }}
          />
        </div>
      )}
    />
  );
}

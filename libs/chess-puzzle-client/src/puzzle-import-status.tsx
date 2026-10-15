import { Trans, useLingui } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { Notice } from '@pkgs/ui-root-client/notice';
import { ProgressBar } from '@pkgs/ui-root-client/progress-bar';
import { type JSX, Show } from 'solid-js';
import type { PuzzleImportRow } from './use-puzzle-import';

export function PuzzleImportStatus(props: {
  job: PuzzleImportRow;
}): JSX.Element {
  const { t } = useLingui();
  const status = () =>
    ({
      adding: t`Adding puzzles`,
      finished: t`Finished`,
      failed: t`Failed`,
      stopped: t`Stopped`,
    })[props.job.status] ?? t`Ready`;
  return (
    <div class="box gap-4" data-testid="puzzle-load-result">
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-testid="puzzle-load-status"
      >
        <Notice>{status()}</Notice>
      </div>
      <ProgressBar
        label={t`Puzzles processed`}
        progress={
          props.job.total_chunks > 0
            ? props.job.completed_chunks / props.job.total_chunks
            : 0
        }
        color="info"
      />
      <MenuSection title={<Trans>Latest load</Trans>} role="group">
        <MenuRow title={<Trans>Source</Trans>} caption={props.job.cursor} />
        <MenuRow
          title={<Trans>Processed</Trans>}
          value={props.job.processed_rows}
        />
        <MenuRow
          title={<Trans>Added</Trans>}
          value={props.job.inserted_rows}
          dataSet={{ testid: 'puzzle-load-added' }}
        />
        <MenuRow
          title={<Trans>Updated</Trans>}
          value={props.job.updated_rows}
          dataSet={{ testid: 'puzzle-load-updated' }}
        />
        <MenuRow
          title={<Trans>Broken</Trans>}
          value={props.job.failed_rows}
          dataSet={{ testid: 'puzzle-load-broken' }}
        />
        <MenuRow
          title={<Trans>Duplicates skipped</Trans>}
          value={props.job.duplicate_rows}
        />
        <MenuRow
          title={<Trans>Last activity</Trans>}
          caption={props.job.updated_at}
        />
        <Show when={props.job.finished_at}>
          <MenuRow
            title={<Trans>Ended</Trans>}
            caption={props.job.finished_at}
          />
        </Show>
      </MenuSection>
      <Show when={props.job.error} keyed>
        {(error) => (
          <div data-testid="puzzle-load-error">
            <Notice tone="error">{error}</Notice>
          </div>
        )}
      </Show>
      <Show when={props.job.status === 'stopped'}>
        <Notice>
          <Trans>
            Puzzles already added or updated are kept. Select the source again
            to start another load.
          </Trans>
        </Notice>
      </Show>
    </div>
  );
}

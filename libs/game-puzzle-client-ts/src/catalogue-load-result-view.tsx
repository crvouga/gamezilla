import { Trans, useLingui } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { ProgressBar } from '@pkgs/ui-root-client-ts/progress-bar';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Match, Show, Switch } from 'solid-js';
import type { CatalogueLoadJob } from './catalogue-load-client';

/** How the latest load stands, in a word, said to a screen reader as it changes. */
function ResultStatus(props: { job: CatalogueLoadJob }): JSX.Element {
  return (
    <StackVertical
      role="status"
      aria-live="polite"
      aria-atomic
      testId="puzzle-load-status"
    >
      {/* Why it failed is the alert below; this is the one status word. */}
      <Notice tone={props.job.status === 'finished' ? 'success' : 'neutral'}>
        <Switch>
          <Match when={props.job.status === 'adding'}>
            <Trans>Adding puzzles</Trans>
          </Match>
          <Match when={props.job.status === 'finished'}>
            <Trans>Finished</Trans>
          </Match>
          <Match when={props.job.status === 'failed'}>
            <Trans>Failed</Trans>
          </Match>
          <Match when={props.job.status === 'stopped'}>
            <Trans>Stopped</Trans>
          </Match>
        </Switch>
      </Notice>
    </StackVertical>
  );
}

/**
 * The latest load on the loader's hub: how it stands, how far it is, what
 * it added, updated and found broken, why it failed and what a stop kept.
 */
export function CatalogueLoadResultView(props: {
  job: CatalogueLoadJob;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical gap="lg" testId="puzzle-load-result">
      <ResultStatus job={props.job} />
      <ProgressBar
        label={t`Puzzles processed`}
        progress={props.job.progress}
      />
      <Show when={props.job.error} keyed>
        {(error) => (
          <Notice tone="error" dataSet={{ testid: 'puzzle-load-error' }}>
            {error}
          </Notice>
        )}
      </Show>
      <MenuSection title={<Trans>Latest load</Trans>}>
        <MenuRow title={<Trans>Source</Trans>} caption={props.job.source} />
        <MenuRow title={<Trans>Processed</Trans>} value={props.job.processed} />
        <MenuRow
          title={<Trans>Added</Trans>}
          value={props.job.added}
          dataSet={{ testid: 'puzzle-load-added' }}
        />
        <MenuRow
          title={<Trans>Updated</Trans>}
          value={props.job.updated}
          dataSet={{ testid: 'puzzle-load-updated' }}
        />
        <MenuRow
          title={<Trans>Broken</Trans>}
          value={props.job.broken}
          dataSet={{ testid: 'puzzle-load-broken' }}
        />
        <MenuRow
          title={<Trans>Duplicates skipped</Trans>}
          value={props.job.duplicates}
        />
        <MenuRow
          title={<Trans>Last activity</Trans>}
          caption={props.job.updatedAt}
        />
        <Show when={props.job.finishedAt} keyed>
          {(finishedAt) => (
            <MenuRow title={<Trans>Ended</Trans>} caption={finishedAt} />
          )}
        </Show>
      </MenuSection>
      <Show when={props.job.status === 'stopped'}>
        <Notice>
          <Trans>
            Puzzles already added or updated are kept. Start loading again to
            add the rest.
          </Trans>
        </Notice>
      </Show>
    </StackVertical>
  );
}

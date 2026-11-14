import { Trans, useLingui } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { ProgressBar } from '@pkgs/ui-root-client-ts/progress-bar';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Match, Show, Switch } from 'solid-js';
import type { CatalogueLoadJob } from './catalogue-load-client';

/** Counts and times in the person's own locale: `1,198,400`, `Nov 14, 2023, 10:10 PM`. */
export function useCatalogueFormat(): {
  readonly count: (value: number) => string;
  readonly time: (iso: string) => string;
} {
  const { i18n } = useLingui();
  return {
    count: (value) => i18n().number(value),
    time: (iso) => {
      const at = new Date(iso);
      return Number.isNaN(at.getTime())
        ? iso
        : i18n().date(at, { dateStyle: 'medium', timeStyle: 'short' });
    },
  };
}

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

/** What a load still running, or stopped, means for the person. */
function ProgressNote(props: { job: CatalogueLoadJob }): JSX.Element {
  return (
    <Switch>
      <Match when={props.job.status === 'adding'}>
        <Trans>
          Loading continues in the background. You can leave and come back to
          follow it or stop it.
        </Trans>
      </Match>
      <Match when={props.job.status === 'stopped'}>
        <Trans>
          Puzzles already added or updated are kept. Start loading again to add
          the rest.
        </Trans>
      </Match>
    </Switch>
  );
}

/**
 * The latest load, at the top of the loader's hub: how it stands and how
 * far it is, what a running or stopped load means, why it failed; then
 * `children` (the hub's command, near the top); then its figures in
 * grouped digits and when it last moved.
 */
export function CatalogueLoadResultView(props: {
  job: CatalogueLoadJob;
  /** What follows how far it is and comes before its figures: the hub's command and rows. */
  children?: JSX.Element;
}): JSX.Element {
  const { t } = useLingui();
  const format = useCatalogueFormat();
  return (
    <StackVertical gap="lg" testId="puzzle-load-result">
      <StackVertical gap="md">
        <ResultStatus job={props.job} />
        <ProgressBar
          label={t`Puzzles processed`}
          progress={props.job.progress}
          description={<ProgressNote job={props.job} />}
        />
        <Show when={props.job.error} keyed>
          {(error) => (
            <Notice tone="error" dataSet={{ testid: 'puzzle-load-error' }}>
              {error}
            </Notice>
          )}
        </Show>
      </StackVertical>
      {props.children}
      <MenuSection title={<Trans>Latest load</Trans>}>
        <MenuRow
          title={<Trans>Processed</Trans>}
          value={format.count(props.job.processed)}
        />
        <MenuRow
          title={<Trans>Added</Trans>}
          value={format.count(props.job.added)}
          dataSet={{ testid: 'puzzle-load-added' }}
        />
        <MenuRow
          title={<Trans>Updated</Trans>}
          value={format.count(props.job.updated)}
          dataSet={{ testid: 'puzzle-load-updated' }}
        />
        <MenuRow
          title={<Trans>Broken</Trans>}
          value={format.count(props.job.broken)}
          dataSet={{ testid: 'puzzle-load-broken' }}
        />
        <MenuRow
          title={<Trans>Duplicates skipped</Trans>}
          value={format.count(props.job.duplicates)}
        />
        <MenuRow title={<Trans>From</Trans>} caption={props.job.source} />
        <MenuRow
          title={<Trans>Last activity</Trans>}
          value={format.time(props.job.updatedAt)}
        />
        <Show when={props.job.finishedAt} keyed>
          {(finishedAt) => (
            <MenuRow
              title={<Trans>Ended</Trans>}
              value={format.time(finishedAt)}
            />
          )}
        </Show>
      </MenuSection>
    </StackVertical>
  );
}

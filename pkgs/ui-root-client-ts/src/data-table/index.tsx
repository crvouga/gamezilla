/** @jsxImportSource solid-js */

import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { EmptyState } from '../empty-state/index';
import { ErrorState } from '../error-state/index';
import { LoadingState } from '../loading-state/index';
import { MetricStrip, type SummaryMetric } from '../metric-strip/index';
import { Table, type TableColumn, type TableSort } from '../table/index';
import {
  type DataTableAction,
  type DataTableFilter,
  DataTableHeader,
  DataTablePager,
  type DataTablePaging,
  type DataTableSearch,
  DataTableToolbar,
} from './data-table-parts';

export type {
  DataTableAction,
  DataTableFilter,
  DataTableFilterOption,
  DataTablePaging,
  DataTableSearch,
} from './data-table-parts';

/** A fact about the whole collection ("Desired 12"), above the rows. */
export type DataTableFact = {
  readonly label: string;
  readonly value: string;
  /** Rendered as the fact's `data-testid`. */
  readonly testId?: string | undefined;
};

/** The last read failed: what went wrong and how to read again. */
export type DataTableFailure = {
  readonly title: string;
  readonly body: string;
  readonly onRetry: () => void;
};

/** What an empty collection says, and what will fill it. */
export type DataTableEmpty = {
  readonly title: string;
  readonly body: string;
};

export type DataTableProps<R, K extends string = string> = {
  /** Names the collection for assistive tech; the screen's title shows it. */
  readonly caption: string;
  /** How many there are, as a sentence ("8 online now"). */
  readonly count?: string | undefined;
  readonly columns: readonly TableColumn<R>[];
  /** The rows last read; `undefined` until the first read lands. */
  readonly rows: readonly R[] | undefined;
  readonly rowKey: (row: R) => string;
  /** Pressing a row opens it (its detail, a live view). */
  readonly onRowPress?: ((row: R) => void) | undefined;
  /** What a pressable row opens, for assistive tech. */
  readonly rowLabel?: ((row: R) => string) | undefined;
  /** The first order of rows a sortable column gives. */
  readonly defaultSort?: TableSort | undefined;
  readonly search?: DataTableSearch | undefined;
  readonly filter?: DataTableFilter<K> | undefined;
  /** Actions on the whole collection, each opening its own surface. */
  readonly actions?: readonly DataTableAction[] | undefined;
  /** Facts about the whole collection, shown above the rows. */
  readonly facts?: readonly DataTableFact[] | undefined;
  /**
   * A read is under way: without rows the loading state replaces them;
   * with rows they stay and a quiet indicator says they are updating.
   */
  readonly loading: boolean;
  /** What the loading state says ("Reading who is online now…"). */
  readonly loadingLabel: string;
  /**
   * The last read failed: without rows the failure replaces them; with
   * rows they stay in view under it. Either way it offers a retry.
   */
  readonly failure?: DataTableFailure | undefined;
  readonly empty: DataTableEmpty;
  readonly paging?: DataTablePaging | undefined;
  /** `data-testid` of the rows' table; each row is `<testId>-<rowKey>`. */
  readonly testId?: string | undefined;
};

function Failure(props: { failure: DataTableFailure }): JSX.Element {
  return (
    <ErrorState
      variant="compact"
      title={props.failure.title}
      body={props.failure.body}
      retry={{ onClick: () => props.failure.onRetry() }}
    />
  );
}

function Facts(props: { facts: readonly DataTableFact[] }): JSX.Element {
  const metrics = (): readonly SummaryMetric[] =>
    props.facts.map((fact) => ({
      label: fact.label,
      value: fact.value,
      testId: fact.testId,
    }));
  return (
    <Show when={props.facts.length > 0}>
      <MetricStrip
        aria-label={props.facts.map((f) => f.label).join(', ')}
        metrics={metrics()}
      />
    </Show>
  );
}

function Rows<R, K extends string>(props: {
  table: DataTableProps<R, K>;
  rows: readonly R[];
}): JSX.Element {
  return (
    <Table
      label={props.table.caption}
      columns={props.table.columns}
      rows={props.rows}
      rowKey={props.table.rowKey}
      onRowPress={props.table.onRowPress}
      rowLabel={props.table.rowLabel}
      defaultSort={props.table.defaultSort}
      testId={props.table.testId}
      empty={
        <EmptyState
          variant="compact"
          title={props.table.empty.title}
          body={props.table.empty.body}
        />
      }
    />
  );
}

/**
 * `DataTable` -- a screen's collection of one kind of thing (people online
 * now, Synthetic Users, workers, events), owning everything a person does
 * with that collection:
 *
 * - a header with the count, a quiet "updating" spinner while a reread
 *   runs, and the collection's `actions` (each opens its own confirm modal
 *   or form; the table never holds a form);
 * - a toolbar: `search` and a `filter` of chips, stacked on a phone and
 *   side by side when wide;
 * - `facts` about the whole collection, as a quiet metric strip;
 * - the rows as a `Table`: full-width columns with sortable headers on a
 *   tablet or desktop, stacked cards headed by the `primary` column on a
 *   phone; rows open what `onRowPress` opens;
 * - its states, each distinct: loading (no rows yet), failed with a retry
 *   (replacing the rows, or above the last rows read so they stay in
 *   view), refreshing (rows kept, spinner in the header), and empty;
 * - `paging` for a collection the server pages.
 *
 * @example
 * ```tsx
 * <DataTable
 *   caption={t`Workers`}
 *   count={t`${workers().length} workers`}
 *   rows={workers()}
 *   rowKey={(worker) => worker.id}
 *   loading={read.loading}
 *   loadingLabel={t`Reading workers…`}
 *   failure={read.error ? { title: t`Workers could not be loaded.`, body: t`Check your connection and try again.`, onRetry: refetch } : undefined}
 *   empty={{ title: t`No workers`, body: t`Workers appear once they report a heartbeat.` }}
 *   columns={[{ key: 'id', header: t`Worker`, primary: true, sortValue: (w) => w.id, render: (w) => w.id }]}
 * />
 * ```
 */
export function DataTable<R, K extends string = string>(
  props: DataTableProps<R, K>
): JSX.Element {
  const rows = () => props.rows;
  return (
    <section
      class="box gap-ui-md"
      aria-label={props.caption}
      {...dataAttrs({ component: 'DataTable' })}
    >
      <DataTableHeader
        count={props.count}
        refreshing={props.loading && props.rows !== undefined}
        actions={props.actions ?? []}
      />
      <DataTableToolbar search={props.search} filter={props.filter} />
      <Facts facts={props.facts ?? []} />
      <Switch>
        <Match when={rows()}>
          {(read) => (
            <>
              <Show when={props.failure}>
                {(failure) => <Failure failure={failure()} />}
              </Show>
              <Rows table={props} rows={read()} />
            </>
          )}
        </Match>
        <Match when={props.failure}>
          {(failure) => <Failure failure={failure()} />}
        </Match>
        <Match when={props.loading}>
          <LoadingState variant="compact" caption={props.loadingLabel} />
        </Match>
      </Switch>
      <DataTablePager paging={props.paging} disabled={props.loading} />
    </section>
  );
}

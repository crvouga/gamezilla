import { asLocalized } from '@pkgs/i18n';
import { OverflowMenuButton } from '@pkgs/ui';
import {
  createMemoryPageLoader,
  DataTable,
  type DataTableColumn,
} from '@pkgs/ui-devtools';
import { createMemo, createSignal, For, type JSX, Show } from 'solid-js';
import { writeClipboard } from './copy-to-clipboard';
import type { SqlStatementResult } from './run-sql-cell';
import { formatProductHarnessDbCell } from './sql-schema-query';

export function SqlCellResults(props: {
  readonly results: () => readonly SqlStatementResult[];
  readonly durationMs: () => number;
  readonly error: () => string | null;
}): JSX.Element {
  const [collapsed, setCollapsed] = createSignal(false);
  return (
    <Show
      when={props.error() == null}
      fallback={
        <div class="box px-2 py-1">
          <p class="text text-destructive text-xs">{props.error()}</p>
        </div>
      }
    >
      <Show when={props.results().length > 0}>
        <div class="box gap-1 border-t border-outline">
          <ResultsHeader
            results={props.results}
            durationMs={props.durationMs}
            collapsed={collapsed}
            onToggle={() => setCollapsed((v) => !v)}
          />
          <Show when={!collapsed()}>
            <ResultsList results={props.results} />
          </Show>
        </div>
      </Show>
    </Show>
  );
}

function ResultsHeader(props: {
  readonly results: () => readonly SqlStatementResult[];
  readonly durationMs: () => number;
  readonly collapsed: () => boolean;
  readonly onToggle: () => void;
}): JSX.Element {
  const status = () => summarize(props.results(), props.durationMs());
  return (
    <div class="box flex-row items-center gap-1 px-2 py-0.5">
      <p class="text flex-1 text-[11px] text-text-secondary">{status()}</p>
      <OverflowMenuButton
        size={24}
        header={{ title: 'Results' }}
        aria-label={asLocalized('Result actions')}
        actions={[
          {
            id: 'toggle',
            label: props.collapsed() ? 'Expand results' : 'Collapse results',
            onClick: props.onToggle,
            endsGroup: true,
          },
          {
            id: 'json',
            label: 'Copy as JSON',
            onClick: () => {
              void writeClipboard(JSON.stringify(props.results(), null, 2));
            },
          },
          {
            id: 'csv',
            label: 'Copy as CSV',
            onClick: () => {
              void writeClipboard(resultsToCsv(props.results()));
            },
          },
        ]}
      />
    </div>
  );
}

function ResultsList(props: {
  readonly results: () => readonly SqlStatementResult[];
}): JSX.Element {
  return (
    <Show when={props.results().length > 0}>
      <For each={props.results()}>
        {(result, index) => <StatementResult result={result} index={index()} />}
      </For>
    </Show>
  );
}

function StatementResult(props: {
  readonly result: SqlStatementResult;
  readonly index: number;
}): JSX.Element {
  const { result, index } = props;
  if (result.kind === 'changes') {
    return (
      <div class="box px-2 py-1">
        <p class="text text-xs text-success">{`#${index + 1} · ${result.changes} change${result.changes === 1 ? '' : 's'}`}</p>
      </div>
    );
  }
  return <RowsResult result={result} index={index} />;
}

function RowsResult(props: {
  readonly result: Extract<SqlStatementResult, { kind: 'rows' }>;
  readonly index: number;
}): JSX.Element {
  const { result, index } = props;
  const columns = createMemo(() => buildColumns(result.columns));
  const loadPage = createMemo(() => createMemoryPageLoader(() => result.rows));
  const note = result.truncated ? ` (truncated at ${result.rows.length})` : '';
  return (
    <div class="box gap-0.5 min-h-0">
      <p class="text px-2 text-[11px] text-text-secondary">{`#${index + 1} · ${result.rows.length} row${result.rows.length === 1 ? '' : 's'}${note}`}</p>
      {result.columns.length === 0 ? (
        <p class="text px-2 py-1 text-xs text-text-secondary">{'0 rows'}</p>
      ) : (
        <DataTable
          class="border-0 rounded-none max-h-60"
          columns={columns()}
          loadPage={loadPage()}
          getRowId={(_row, i) => `${index}-${i}`}
          sourceKey={`${index}:${result.rows.length}:${result.columns.join(',')}`}
          pageSize={50}
          emptyTitle="0 rows"
          density="compact"
        />
      )}
    </div>
  );
}

function buildColumns(
  columns: readonly string[]
): DataTableColumn<Record<string, unknown>>[] {
  return columns.map((col) => ({
    id: col,
    header: col,
    width: 120,
    sortable: true,
    getValue: (row) => formatProductHarnessDbCell(row[col]),
  }));
}

function summarize(
  results: readonly SqlStatementResult[],
  durationMs: number
): string {
  let rows = 0;
  let changes = 0;
  for (const r of results) {
    if (r.kind === 'rows') rows += r.rows.length;
    else changes += r.changes;
  }
  const parts: string[] = [];
  if (rows > 0) parts.push(`${rows} row${rows === 1 ? '' : 's'}`);
  if (changes > 0) parts.push(`${changes} change${changes === 1 ? '' : 's'}`);
  if (parts.length === 0) parts.push('ok');
  parts.push(`${durationMs} ms`);
  return parts.join(' · ');
}

function resultsToCsv(results: readonly SqlStatementResult[]): string {
  const blocks: string[] = [];
  for (const r of results) {
    if (r.kind !== 'rows') {
      blocks.push(`changes,${r.changes}`);
      continue;
    }
    const cols = r.columns;
    blocks.push(cols.map(csvEscape).join(','));
    for (const row of r.rows) {
      blocks.push(
        cols.map((c) => csvEscape(formatProductHarnessDbCell(row[c]))).join(',')
      );
    }
  }
  return blocks.join('\n');
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

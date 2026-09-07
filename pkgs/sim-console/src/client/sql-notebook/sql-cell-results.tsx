import { asLocalized } from '@pkgs/i18n';
import {
  Box,
  createMemoryPageLoader,
  DataTable,
  type DataTableColumn,
  OverflowMenuButton,
  Text,
} from '@pkgs/ui';
import { createMemo, createSignal, For, type JSX, Show } from 'solid-js';
import { writeClipboard } from './copy-to-clipboard';
import type { SqlStatementResult } from './run-sql-cell';
import { formatPlaygroundDbCell } from './sql-schema-query';

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
        <Box sx={{ px: 2, py: 1 }}>
          <Text
            sx={{ color: 'destructive', fontSize: 12 }}
            label={props.error()}
          />
        </Box>
      }
    >
      <Show when={props.results().length > 0}>
        <Box sx={{ gap: 1, borderTopWidth: 1, borderColor: 'outline' }}>
          <ResultsHeader
            results={props.results}
            durationMs={props.durationMs}
            collapsed={collapsed}
            onToggle={() => setCollapsed((v) => !v)}
          />
          <Show when={!collapsed()}>
            <ResultsList results={props.results} />
          </Show>
        </Box>
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
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 0.5,
      }}
    >
      <Text
        sx={{ flex: 1, fontSize: 11, color: 'textSecondary' }}
        label={status()}
      />
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
    </Box>
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
      <Box sx={{ px: 2, py: 1 }}>
        <Text
          sx={{ fontSize: 12, color: 'success' }}
          label={`#${index + 1} · ${result.changes} change${result.changes === 1 ? '' : 's'}`}
        />
      </Box>
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
    <Box sx={{ gap: 0.5, minHeight: 0 }}>
      <Text
        sx={{ px: 2, fontSize: 11, color: 'textSecondary' }}
        label={`#${index + 1} · ${result.rows.length} row${result.rows.length === 1 ? '' : 's'}${note}`}
      />
      {result.columns.length === 0 ? (
        <Text
          sx={{ px: 2, py: 1, fontSize: 12, color: 'textSecondary' }}
          label="0 rows"
        />
      ) : (
        <DataTable
          columns={columns()}
          loadPage={loadPage()}
          getRowId={(_row, i) => `${index}-${i}`}
          sourceKey={`${index}:${result.rows.length}:${result.columns.join(',')}`}
          pageSize={50}
          emptyTitle="0 rows"
          density="compact"
          sx={{ borderWidth: 0, borderRadius: 'none', maxHeight: 240 }}
        />
      )}
    </Box>
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
    getValue: (row) => formatPlaygroundDbCell(row[col]),
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
        cols.map((c) => csvEscape(formatPlaygroundDbCell(row[c]))).join(',')
      );
    }
  }
  return blocks.join('\n');
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

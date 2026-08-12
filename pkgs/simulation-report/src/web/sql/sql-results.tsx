import type { SqlValue } from '@sqlite.org/sqlite-wasm';
import type { CSSProperties } from 'react';

import { wallClipboardWriteText } from '../wall';
import type { SqlQueryResult } from './frame-sqlite';
import { sqlPanelStyles as s } from './sql-panel-styles';

export function SqlResults(props: {
  readonly result: SqlQueryResult | null;
  readonly error: string | null;
}) {
  if (props.error) {
    return <div style={s.errorBox}>{props.error}</div>;
  }
  if (!props.result) {
    return (
      <div style={s.muted}>
        Run a query (⌘/Ctrl+Enter) to inspect this node.
      </div>
    );
  }
  const { columns, rows, changes } = props.result;
  if (columns.length === 0) {
    return (
      <div style={s.muted}>
        Statement completed{changes > 0 ? ` · ${changes} change(s)` : ''}.
      </div>
    );
  }
  return (
    <div style={s.resultsRoot}>
      <div style={s.resultsMeta}>
        {rows.length} row{rows.length === 1 ? '' : 's'} · {columns.length}{' '}
        column{columns.length === 1 ? '' : 's'}
        <button
          type="button"
          style={s.ghostBtn as CSSProperties}
          onClick={() => copyTsv(columns, rows)}
        >
          Copy TSV
        </button>
      </div>
      <div style={s.resultsScroll}>
        <table style={s.resultsTable}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c} style={s.resultsTh}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} style={s.resultsTd}>
                    {formatCell(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(value: SqlValue): string {
  if (value === null) return 'NULL';
  if (typeof value === 'object') return '[blob]';
  return String(value);
}

function copyTsv(
  columns: readonly string[],
  rows: readonly (readonly SqlValue[])[]
): void {
  const lines = [
    columns.join('\t'),
    ...rows.map((r) => r.map((c) => formatCell(c)).join('\t')),
  ];
  void wallClipboardWriteText(lines.join('\n'));
}

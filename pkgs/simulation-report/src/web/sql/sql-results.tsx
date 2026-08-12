import type { SqlValue } from '@sqlite.org/sqlite-wasm';
import type { CSSProperties } from 'react';

import { wallClipboardWriteText } from '../wall';
import type { SqlQueryResult } from './frame-sqlite';
import { sqlPanelStyles as s } from './sql-panel-styles';
import {
  PAGE_SIZE_OPTIONS,
  pageCount,
  pageRangeLabel,
  type TableBrowse,
} from './table-browse';

export type SqlResultsBrowseControls = {
  readonly browse: TableBrowse;
  readonly totalRows: number | null;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
};

export function SqlResults(props: {
  readonly result: SqlQueryResult | null;
  readonly error: string | null;
  readonly browseControls?: SqlResultsBrowseControls | null;
}) {
  if (props.error) {
    return <div style={s.errorBox}>{props.error}</div>;
  }
  if (!props.result) {
    return (
      <div style={s.muted}>
        Pick a table or run a query (⌘/Ctrl+Enter) to inspect this node.
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
  const browse = props.browseControls?.browse ?? null;
  const totalRows = props.browseControls?.totalRows ?? null;
  const metaLabel =
    browse && totalRows != null
      ? pageRangeLabel({
          page: browse.page,
          pageSize: browse.pageSize,
          totalRows,
          rowCount: rows.length,
        })
      : `${rows.length} row${rows.length === 1 ? '' : 's'} · ${columns.length} column${columns.length === 1 ? '' : 's'}`;
  return (
    <div style={s.resultsRoot}>
      <div style={s.resultsMeta}>
        {metaLabel}
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
      {props.browseControls ? (
        <ResultsPager
          browse={props.browseControls.browse}
          totalRows={props.browseControls.totalRows}
          rowCount={rows.length}
          onPageChange={props.browseControls.onPageChange}
          onPageSizeChange={props.browseControls.onPageSizeChange}
        />
      ) : null}
    </div>
  );
}

function ResultsPager(props: {
  readonly browse: TableBrowse;
  readonly totalRows: number | null;
  readonly rowCount: number;
  readonly onPageChange: (page: number) => void;
  readonly onPageSizeChange: (pageSize: number) => void;
}) {
  const { browse, totalRows, rowCount, onPageChange, onPageSizeChange } = props;
  const page = browse.page;
  const pages =
    totalRows != null ? pageCount(totalRows, browse.pageSize) : null;
  const atStart = page <= 0;
  const atEnd = pages != null ? page >= pages - 1 : rowCount < browse.pageSize;
  const pageLabel =
    pages != null ? `Page ${page + 1} / ${pages}` : `Page ${page + 1}`;
  return (
    <div style={s.resultsPager}>
      <button
        type="button"
        style={s.ghostBtn as CSSProperties}
        disabled={atStart}
        aria-label="Previous page"
        onClick={() => onPageChange(page - 1)}
      >
        ◀
      </button>
      <span>{pageLabel}</span>
      <button
        type="button"
        style={s.ghostBtn as CSSProperties}
        disabled={atEnd}
        aria-label="Next page"
        onClick={() => onPageChange(page + 1)}
      >
        ▶
      </button>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        Page size
        <select
          style={s.pageSizeSelect as CSSProperties}
          value={browse.pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
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

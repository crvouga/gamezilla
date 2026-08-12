import type { CSSProperties } from 'react';

import type { SqlHistoryEntry } from './sql-history';
import { sqlPanelStyles as s } from './sql-panel-styles';

export function SqlEditorToolbar(props: {
  readonly ready: boolean;
  readonly statusLabel: string;
  readonly history: readonly SqlHistoryEntry[];
  readonly onRun: () => void;
  readonly onPickHistory: (sql: string) => void;
}) {
  return (
    <div style={s.editorToolbar}>
      <button
        type="button"
        style={s.ghostBtn as CSSProperties}
        disabled={!props.ready}
        onClick={props.onRun}
      >
        Run
      </button>
      {props.history.length > 0 ? (
        <select
          style={s.historySelect as CSSProperties}
          value=""
          onChange={(e) => {
            const v = e.target.value;
            if (v) props.onPickHistory(v);
            e.target.value = '';
          }}
        >
          <option value="">History…</option>
          {props.history.map((h) => (
            <option key={`${h.atMs}:${h.sql}`} value={h.sql}>
              {h.sql.length > 60 ? `${h.sql.slice(0, 60)}…` : h.sql}
            </option>
          ))}
        </select>
      ) : null}
      <span style={s.muted}>{props.statusLabel}</span>
    </div>
  );
}

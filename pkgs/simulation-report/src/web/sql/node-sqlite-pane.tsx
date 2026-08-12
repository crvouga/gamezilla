import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type { SimulationFrameDatabase } from '../../types';
import type { FlatFrame } from '../frames';
import { wallNowMs } from '../wall';
import { runSql, type SqlQueryResult } from './frame-sqlite';
import { SchemaBrowser } from './schema-browser';
import { SqlEditor } from './sql-editor';
import { SqlEditorToolbar } from './sql-editor-toolbar';
import { listSqlHistory, pushSqlHistory } from './sql-history';
import { sqlPanelStyles as s } from './sql-panel-styles';
import { SqlResults } from './sql-results';
import {
  diffBySha,
  diffSqliteDatabases,
  type SqliteFrameDiff,
} from './sqlite-diff';
import { useFrameSqlite } from './use-frame-sqlite';

export type SqlPaneMode = 'query' | 'diff';

export function NodeSqlitePane(props: {
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly prevFrame: FlatFrame | null;
  readonly nodeId: string;
}) {
  const node = useMemo(
    () =>
      props.frame?.databases?.find((d) => d.nodeId === props.nodeId) ?? null,
    [props.frame, props.nodeId]
  );
  const prevNode = useMemo(
    () =>
      props.prevFrame?.databases?.find((d) => d.nodeId === props.nodeId) ??
      null,
    [props.prevFrame, props.nodeId]
  );
  const [mode, setMode] = useState<SqlPaneMode>('diff');

  if (!node) {
    return (
      <div style={s.muted}>
        No SQLite dump for `{props.nodeId}` on this frame.
      </div>
    );
  }

  return (
    <div style={s.nodeSqlRoot}>
      <div style={s.modeTabs}>
        <ModeBtn active={mode === 'diff'} onClick={() => setMode('diff')}>
          Diff
        </ModeBtn>
        <ModeBtn active={mode === 'query'} onClick={() => setMode('query')}>
          Query
        </ModeBtn>
      </div>
      {mode === 'diff' ? (
        <SqliteDiffView
          bucketId={props.bucketId}
          runId={props.runId}
          testId={props.testId}
          node={node}
          prevNode={prevNode}
        />
      ) : (
        <SqliteQueryView
          bucketId={props.bucketId}
          runId={props.runId}
          testId={props.testId}
          node={node}
        />
      )}
    </div>
  );
}

function ModeBtn(props: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: string;
}) {
  return (
    <button
      type="button"
      style={(props.active ? s.nodeTabActive : s.nodeTab) as CSSProperties}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

function SqliteDiffView(props: {
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly node: SimulationFrameDatabase;
  readonly prevNode: SimulationFrameDatabase | null;
}) {
  const fast = diffBySha(props.prevNode?.sha256, props.node.sha256);
  const prev = useFrameSqlite({
    bucketId: props.bucketId,
    runId: props.runId,
    testId: props.testId,
    node: fast ? null : props.prevNode,
  });
  const next = useFrameSqlite({
    bucketId: props.bucketId,
    runId: props.runId,
    testId: props.testId,
    node: props.node,
  });
  const [diff, setDiff] = useState<SqliteFrameDiff | null>(fast);

  useEffect(() => {
    if (fast) {
      setDiff(fast);
      return;
    }
    if (prev.status !== 'ready' || next.status !== 'ready') return;
    if (!prev.handle || !next.handle) return;
    setDiff(diffSqliteDatabases(prev.handle.db, next.handle.db));
  }, [fast, prev.status, next.status, prev.handle, next.handle]);

  if (!props.prevNode) {
    return <div style={s.muted}>No previous frame to diff against.</div>;
  }
  if (fast?.identical) {
    return <div style={s.muted}>No SQLite changes (same content hash).</div>;
  }
  if (!diff) {
    return <div style={s.muted}>Computing diff…</div>;
  }
  if (diff.identical) {
    return <div style={s.muted}>No SQLite changes.</div>;
  }
  return (
    <div style={s.diffRoot}>
      {(diff.schema.addedTables.length > 0 ||
        diff.schema.removedTables.length > 0) && (
        <div style={s.diffSection}>
          <div style={s.schemaGroupTitle}>Schema</div>
          {diff.schema.addedTables.map((t) => (
            <div key={`+${t}`} style={s.diffAdded}>
              + table {t}
            </div>
          ))}
          {diff.schema.removedTables.map((t) => (
            <div key={`-${t}`} style={s.diffRemoved}>
              − table {t}
            </div>
          ))}
        </div>
      )}
      {diff.tables.map((table) => (
        <div key={table.table} style={s.diffSection}>
          <div style={s.schemaGroupTitle}>
            {table.table} · {table.prevCount} → {table.nextCount} rows
          </div>
          {table.rows.map((row, i) => (
            <div
              key={`${table.table}:${i}`}
              style={
                row.kind === 'added'
                  ? s.diffAdded
                  : row.kind === 'removed'
                    ? s.diffRemoved
                    : s.diffChanged
              }
            >
              {row.kind === 'added' ? '+' : row.kind === 'removed' ? '−' : '~'}{' '}
              {row.values
                .map((v) => (v === null ? 'NULL' : String(v)))
                .join(' · ')}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function SqliteQueryView(props: {
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly node: SimulationFrameDatabase;
}) {
  const sqlite = useFrameSqlite({
    bucketId: props.bucketId,
    runId: props.runId,
    testId: props.testId,
    node: props.node,
  });
  const nodeId = props.node.nodeId;
  const [sql, setSql] = useState(
    "SELECT name, type FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name;"
  );
  const [result, setResult] = useState<SqlQueryResult | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [historyTick, setHistoryTick] = useState(0);
  const history = listSqlHistory(nodeId);
  void historyTick;

  useEffect(() => {
    setResult(null);
    setQueryError(null);
  }, [props.node.sha256]);

  const run = () => {
    if (!sqlite.handle) return;
    try {
      const next = runSql(sqlite.handle.db, sql);
      setResult(next);
      setQueryError(null);
      pushSqlHistory(nodeId, sql, wallNowMs());
      setHistoryTick((n) => n + 1);
    } catch (err) {
      setResult(null);
      setQueryError(err instanceof Error ? err.message : String(err));
    }
  };

  const statusLabel =
    sqlite.status === 'loading'
      ? 'Loading dump…'
      : sqlite.status === 'error'
        ? (sqlite.error ?? 'error')
        : `${props.node.byteLength} B`;

  return (
    <div style={s.body}>
      <SchemaBrowser objects={sqlite.schema} onInsertSql={setSql} />
      <div style={s.work}>
        <div style={s.editorColumn}>
          <SqlEditorToolbar
            ready={sqlite.status === 'ready'}
            statusLabel={statusLabel}
            history={history}
            onRun={run}
            onPickHistory={setSql}
          />
          <SqlEditor
            value={sql}
            onChange={setSql}
            onRun={run}
            disabled={sqlite.status !== 'ready'}
          />
        </div>
        <SqlResults
          result={result}
          error={
            queryError ?? (sqlite.status === 'error' ? sqlite.error : null)
          }
        />
      </div>
    </div>
  );
}

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
import { useFrameSqlite } from './use-frame-sqlite';

export function SqlitePanel(props: {
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly open: boolean;
  readonly onToggle: () => void;
}) {
  if (!props.open) return null;
  return <SqlitePanelOpen {...props} />;
}

function SqlitePanelOpen(props: {
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly onToggle: () => void;
}) {
  const databases = props.frame?.databases ?? [];
  const defaultNodeId = pickDefaultNodeId(databases, props.frame?.step.actorId);
  const [nodeId, setNodeId] = useState<string | null>(defaultNodeId);

  useEffect(() => {
    setNodeId(pickDefaultNodeId(databases, props.frame?.step.actorId));
  }, [props.frame?.globalIndex, databases, props.frame?.step.actorId]);

  const node = useMemo(
    () => databases.find((d) => d.nodeId === nodeId) ?? databases[0] ?? null,
    [databases, nodeId]
  );

  if (databases.length === 0) {
    return (
      <div style={s.empty}>
        No SQLite dumps on this frame (legacy report or capture skipped).
        <button type="button" style={s.hideBtn} onClick={props.onToggle}>
          Hide
        </button>
      </div>
    );
  }

  return (
    <div style={s.dock}>
      <div style={s.toolbar}>
        <span style={s.toolbarTitle}>SQLite</span>
        <div style={s.nodeTabs}>
          {databases.map((d) => (
            <button
              key={d.nodeId}
              type="button"
              style={
                d.nodeId === (node?.nodeId ?? '') ? s.nodeTabActive : s.nodeTab
              }
              onClick={() => setNodeId(d.nodeId)}
            >
              {d.nodeId}
            </button>
          ))}
        </div>
        <button type="button" style={s.ghostBtn} onClick={props.onToggle}>
          Hide
        </button>
      </div>
      <SqlitePanelBody
        bucketId={props.bucketId}
        runId={props.runId}
        testId={props.testId}
        node={node}
      />
    </div>
  );
}

function SqlitePanelBody(props: {
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly node: SimulationFrameDatabase | null;
}) {
  const sqlite = useFrameSqlite({
    bucketId: props.bucketId,
    runId: props.runId,
    testId: props.testId,
    node: props.node,
  });
  const nodeId = props.node?.nodeId ?? 'server';
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
  }, [props.node?.sha256]);

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
        : `${props.node?.byteLength ?? 0} B · ${nodeId}`;

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

function pickDefaultNodeId(
  databases: readonly SimulationFrameDatabase[],
  actorId: string | undefined
): string | null {
  if (databases.length === 0) return null;
  if (actorId && databases.some((d) => d.nodeId === actorId)) return actorId;
  const server = databases.find((d) => d.nodeId === 'server');
  return server?.nodeId ?? databases[0]!.nodeId;
}

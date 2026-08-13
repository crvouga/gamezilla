import type { SimulationFrameDatabase } from '../../types';
import { SchemaBrowser } from './schema-browser';
import { SqlEditor } from './sql-editor';
import { SqlEditorToolbar } from './sql-editor-toolbar';
import { sqlPanelStyles as s } from './sql-panel-styles';
import { SqlResults } from './sql-results';
import { useSqliteQuerySession } from './use-sqlite-query-session';

export function SqliteQueryView(props: {
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly node: SimulationFrameDatabase | null;
}) {
  const q = useSqliteQuerySession(props);
  const statusLabel = resolveStatusLabel(q.sqlite, props.node);

  return (
    <div style={s.body}>
      <SchemaBrowser
        objects={q.sqlite.schema}
        activeName={q.browse?.name ?? null}
        onInspect={q.onInspect}
      />
      <div style={s.work}>
        <div style={s.editorColumn}>
          <SqlEditorToolbar
            ready={q.sqlite.status === 'ready'}
            statusLabel={statusLabel}
            history={q.history}
            onRun={() => q.runFreeform(q.sql)}
            onPickHistory={(picked) => {
              q.setSql(picked);
              q.clearBrowse();
              q.runFreeform(picked);
            }}
          />
          <SqlEditor
            value={q.sql}
            onChange={(next) => {
              q.setSql(next);
              q.clearBrowse();
            }}
            onRun={() => q.runFreeform(q.sql)}
            disabled={q.sqlite.status !== 'ready'}
          />
        </div>
        {props.node == null ? (
          <div style={s.muted}>No SQLite dump for this node on this frame.</div>
        ) : q.sqlite.status === 'loading' && q.browse ? (
          <div style={s.muted}>Loading dump…</div>
        ) : (
          <SqlResults
            result={q.result}
            error={
              q.queryError ??
              (q.sqlite.status === 'error' ? q.sqlite.error : null)
            }
            browseControls={q.browseControls}
          />
        )}
      </div>
    </div>
  );
}

function resolveStatusLabel(
  sqlite: ReturnType<typeof useSqliteQuerySession>['sqlite'],
  node: SimulationFrameDatabase | null
): string {
  if (node == null) return 'No dump';
  if (sqlite.status === 'loading') return 'Loading dump…';
  if (sqlite.status === 'error') return sqlite.error ?? 'error';
  return `${node.byteLength} B`;
}

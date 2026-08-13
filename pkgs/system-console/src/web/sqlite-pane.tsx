import { type CSSProperties, useEffect, useMemo, useState } from 'react';

import type { SimulationFrameDatabase } from '../types';
import { testFrameUrl } from './api-client';
import type { FlatFrame } from './frames';
import {
  type FrameSqliteHandle,
  fetchAndOpenFrameDb,
  listSchemaObjects,
  runSql,
} from './sql/frame-sqlite';
import { merge, styles, t } from './theme';

export function SqlitePane(props: {
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly nodeId: string | null;
}) {
  const dump = useMemo(
    () => resolveDatabase(props.frame, props.nodeId),
    [props.frame, props.nodeId]
  );
  const { handle, error } = useFrameSqlite(dump, props);

  if (dump == null) {
    return (
      <div style={pane}>
        <div style={styles.empty}>
          No SQLite dump for node `{props.nodeId ?? '—'}` on this frame.
        </div>
      </div>
    );
  }
  if (error != null) {
    return (
      <div style={pane}>
        <div style={styles.empty}>Failed to open SQLite: {error}</div>
      </div>
    );
  }
  if (handle == null) {
    return <div style={pane}>Loading SQLite…</div>;
  }
  return <SqliteBrowse nodeId={props.nodeId} dump={dump} handle={handle} />;
}

function useFrameSqlite(
  dump: SimulationFrameDatabase | null,
  loc: {
    readonly bucketId: string;
    readonly runId: string;
    readonly testId: string;
  }
): { handle: FrameSqliteHandle | null; error: string | null } {
  const [handle, setHandle] = useState<FrameSqliteHandle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dump == null) {
      setHandle(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const url = testFrameUrl(loc.bucketId, loc.runId, loc.testId, dump.file);
    void (async () => {
      try {
        const next = await fetchAndOpenFrameDb({
          url,
          sha256: dump.sha256,
        });
        if (cancelled) {
          next.close();
          return;
        }
        setHandle((prev) => {
          prev?.close();
          return next;
        });
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setHandle(null);
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dump, loc.bucketId, loc.runId, loc.testId]);

  useEffect(() => {
    return () => {
      setHandle((prev) => {
        prev?.close();
        return null;
      });
    };
  }, []);

  return { handle, error };
}

function SqliteBrowse(props: {
  readonly nodeId: string | null;
  readonly dump: SimulationFrameDatabase;
  readonly handle: FrameSqliteHandle;
}) {
  const [table, setTable] = useState<string | null>(null);
  const tables = listSchemaObjects(props.handle.db)
    .filter((o) => o.type === 'table')
    .map((o) => o.name);
  const active = table != null && tables.includes(table) ? table : tables[0];
  const result =
    active !== undefined
      ? runSql(
          props.handle.db,
          `SELECT * FROM "${active.replaceAll('"', '""')}" LIMIT 100`
        )
      : null;

  return (
    <div style={pane}>
      <div style={toolbar}>
        <span style={{ color: t.muted }}>
          {props.nodeId ?? 'node'} · {props.dump.sha256.slice(0, 8)}
        </span>
        <select
          aria-label="Table"
          value={active ?? ''}
          onChange={(e) => setTable(e.target.value)}
          style={styles.breadcrumbSelect}
        >
          {tables.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>
      {result == null || result.columns.length === 0 ? (
        <div style={styles.empty}>No tables / rows.</div>
      ) : (
        <RowTable columns={result.columns} rows={result.rows} />
      )}
    </div>
  );
}

function RowTable(props: {
  readonly columns: readonly string[];
  readonly rows: readonly (readonly unknown[])[];
}) {
  return (
    <div style={scroll}>
      <table style={styles.suiteTable}>
        <thead>
          <tr>
            {props.columns.map((col) => (
              <th key={col} style={styles.th}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} style={merge(styles.td, { fontSize: 11 })}>
                  {cell == null ? 'NULL' : String(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function resolveDatabase(
  frame: FlatFrame | null,
  nodeId: string | null
): SimulationFrameDatabase | null {
  if (frame == null || nodeId == null) return null;
  const fromDatabases = frame.databases?.find((d) => d.nodeId === nodeId);
  if (fromDatabases) return fromDatabases;
  const fromAttrs = frame.attributes?.find(
    (a) => a.kind === 'sqlite' && a.nodeId === nodeId
  );
  if (
    fromAttrs?.file == null ||
    fromAttrs.sha256 == null ||
    fromAttrs.byteLength == null
  ) {
    return null;
  }
  return {
    nodeId: fromAttrs.nodeId,
    file: fromAttrs.file,
    sha256: fromAttrs.sha256,
    byteLength: fromAttrs.byteLength,
  };
}

const pane: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  minWidth: 0,
  height: '100%',
  background: t.panel,
};

const toolbar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 12px',
  borderBottom: `1px solid ${t.border}`,
};

const scroll: CSSProperties = {
  minHeight: 0,
  overflow: 'auto',
  padding: 8,
};

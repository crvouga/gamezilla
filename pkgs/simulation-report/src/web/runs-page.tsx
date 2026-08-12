import { useState } from 'react';

import type { RunSummary } from '../types';

function formatUpdated(ms: number): string {
  try {
    return new Date(ms)
      .toISOString()
      .replace('T', ' ')
      .replace(/\.\d+Z$/, 'Z');
  } catch {
    return String(ms);
  }
}

export function RunsPage(props: {
  readonly bucketId: string;
  readonly bucketLabel: string;
  readonly runs: readonly RunSummary[];
  readonly generation: number;
  readonly onBack: () => void;
  readonly onOpenRun: (runId: string) => void;
  readonly onDeleteRun: (runId: string) => Promise<void>;
  readonly onKeepLast: (n: number) => Promise<void>;
}) {
  const {
    bucketId,
    bucketLabel,
    runs,
    generation,
    onBack,
    onOpenRun,
    onDeleteRun,
    onKeepLast,
  } = props;
  const [keepLast, setKeepLast] = useState(5);
  const [busy, setBusy] = useState(false);

  return (
    <div className="suite-page">
      <header>
        <button type="button" className="back" onClick={onBack}>
          ← Buckets
        </button>
        <h1>{bucketLabel}</h1>
        <span className="meta">
          {bucketId} · {runs.length} run{runs.length === 1 ? '' : 's'} · gen{' '}
          {generation}
        </span>
      </header>
      <div className="prune-bar">
        <label>
          Keep last
          <input
            type="number"
            min={0}
            value={keepLast}
            onChange={(e) => setKeepLast(Number(e.target.value) || 0)}
          />
        </label>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onKeepLast(keepLast).finally(() => setBusy(false));
          }}
        >
          Prune
        </button>
      </div>
      <table className="suite-table">
        <thead>
          <tr>
            <th>Run</th>
            <th>Status</th>
            <th>Updated</th>
            <th>Tests</th>
            <th>Frames</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {runs.length === 0 ? (
            <tr>
              <td colSpan={6} className="empty">
                No runs yet. Write reports with{' '}
                <code>report: {'{ store, testId }'}</code>.
              </td>
            </tr>
          ) : (
            runs.map((r) => (
              <tr key={r.id}>
                <td
                  className="test-id run-link"
                  onClick={() => onOpenRun(r.id)}
                >
                  {r.id}
                </td>
                <td>
                  <span className={`badge ${r.status}`}>
                    {r.status.toUpperCase()}
                  </span>
                </td>
                <td>{formatUpdated(r.updatedAtMs)}</td>
                <td>{r.testCount}</td>
                <td>{r.frameCount}</td>
                <td>
                  <button
                    type="button"
                    className="btn"
                    disabled={busy}
                    onClick={() => {
                      setBusy(true);
                      void onDeleteRun(r.id).finally(() => setBusy(false));
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

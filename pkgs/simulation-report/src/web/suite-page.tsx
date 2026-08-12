import type { SuiteTestSummary } from '../types';
import { formatMs } from './frames';

export function SuitePage(props: {
  readonly bucketId: string;
  readonly runId: string;
  readonly tests: readonly SuiteTestSummary[];
  readonly onBack: () => void;
  readonly onOpenTest: (testId: string) => void;
}) {
  const { bucketId, runId, tests, onBack, onOpenTest } = props;
  const passed = tests.filter((t) => t.status === 'passed').length;

  return (
    <div className="suite-page">
      <header>
        <button type="button" className="back" onClick={onBack}>
          ← Runs
        </button>
        <h1>Run {runId}</h1>
        <span className="meta">
          {bucketId} · {tests.length} test{tests.length === 1 ? '' : 's'}
          {tests.length ? ` · ${passed} passed` : ''}
        </span>
      </header>
      <table className="suite-table">
        <thead>
          <tr>
            <th>Test</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Steps</th>
            <th>Frames</th>
          </tr>
        </thead>
        <tbody>
          {tests.length === 0 ? (
            <tr>
              <td colSpan={5} className="empty">
                No tests in this run yet.
              </td>
            </tr>
          ) : (
            tests.map((t) => (
              <tr key={t.testId} onClick={() => onOpenTest(t.testId)}>
                <td className="test-id">{t.testId}</td>
                <td>
                  <span className={`badge ${t.status}`}>
                    {t.status.toUpperCase()}
                  </span>
                </td>
                <td>{formatMs(t.durationMs)}</td>
                <td>{t.stepCount}</td>
                <td>{t.frameCount}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

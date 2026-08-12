import type { ReactNode } from 'react';

import type { SuiteTestSummary } from '../types';
import { formatMs } from './frames';
import { ReportHeader } from './report-header';
import { badgeStyle, merge, styles, useHoverStyle } from './theme';

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
    <div style={styles.appShell}>
      <ReportHeader
        back={{ label: '← Runs', onClick: onBack }}
        title={`Run ${runId}`}
        meta={`${bucketId} · ${tests.length} test${tests.length === 1 ? '' : 's'}${tests.length ? ` · ${passed} passed` : ''}`}
      />
      <div style={styles.appBody}>
        <table style={styles.suiteTable}>
          <thead>
            <tr>
              <th style={styles.th}>Test</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Duration</th>
              <th style={styles.th}>Steps</th>
              <th style={styles.th}>Frames</th>
            </tr>
          </thead>
          <tbody>
            {tests.length === 0 ? (
              <tr>
                <td colSpan={5} style={styles.empty}>
                  No tests in this run yet.
                </td>
              </tr>
            ) : (
              tests.map((t) => (
                <HoverRow key={t.testId} onClick={() => onOpenTest(t.testId)}>
                  <td style={merge(styles.td, styles.testId)}>{t.testId}</td>
                  <td style={styles.td}>
                    <span style={badgeStyle(t.status)}>
                      {t.status.toUpperCase()}
                    </span>
                  </td>
                  <td style={styles.td}>{formatMs(t.durationMs)}</td>
                  <td style={styles.td}>{t.stepCount}</td>
                  <td style={styles.td}>{t.frameCount}</td>
                </HoverRow>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function HoverRow(props: {
  readonly onClick?: () => void;
  readonly children: ReactNode;
}) {
  const { onClick, children } = props;
  const hover = useHoverStyle(
    onClick ? styles.trBase : merge({ cursor: 'default' }),
    styles.trHover,
    !onClick
  );
  return (
    <tr
      style={hover.style}
      onClick={onClick}
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
    >
      {children}
    </tr>
  );
}

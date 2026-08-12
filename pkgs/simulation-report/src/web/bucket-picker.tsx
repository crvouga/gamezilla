import { useMemo } from 'react';

import type { RunSummary, SuiteTestSummary } from '../types';
import type { BucketInfo } from './api-client';
import { useRegisterCommands } from './commands/registry';
import type { Command } from './commands/types';
import { NavBreadcrumb } from './nav-breadcrumb';
import { ReportHeader } from './report-header';
import type { ReportNavState } from './router';
import { HoverRow } from './suite-page';
import { merge, styles } from './theme';

export function BucketPicker(props: {
  readonly nav: ReportNavState;
  readonly buckets: readonly BucketInfo[];
  readonly runs: readonly RunSummary[];
  readonly tests: readonly SuiteTestSummary[];
  readonly onNav: (nav: ReportNavState) => void;
  readonly onOpen: (bucketId: string) => void;
}) {
  const { nav, buckets, runs, tests, onNav, onOpen } = props;
  const commands = useMemo((): Command[] => {
    return buckets.map((b, i) => {
      const base = {
        id: `bucket.open.${b.id}`,
        label: `Open bucket ${b.label}`,
        section: 'Navigation' as const,
        run: () => onOpen(b.id),
      };
      if (i >= 9) return base;
      return {
        ...base,
        shortcut: String(i + 1),
        match: (e: KeyboardEvent) => e.key === String(i + 1) && !e.metaKey,
      };
    });
  }, [buckets, onOpen]);
  useRegisterCommands(commands);

  return (
    <div style={styles.appShell}>
      <ReportHeader
        breadcrumb={
          <NavBreadcrumb
            nav={nav}
            buckets={buckets}
            runs={runs}
            tests={tests}
            onNav={onNav}
          />
        }
        meta={`${buckets.length} bucket${buckets.length === 1 ? '' : 's'}`}
      />
      <div style={styles.appBody}>
        {buckets.length === 0 ? (
          <p style={styles.empty}>No buckets configured.</p>
        ) : (
          <table style={styles.suiteTable}>
            <thead>
              <tr>
                <th style={styles.th}>Bucket</th>
                <th style={styles.th}>Id</th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => (
                <HoverRow key={b.id} onClick={() => onOpen(b.id)}>
                  <td style={merge(styles.td, styles.testId)}>{b.label}</td>
                  <td style={merge(styles.td, styles.meta)}>{b.id}</td>
                </HoverRow>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

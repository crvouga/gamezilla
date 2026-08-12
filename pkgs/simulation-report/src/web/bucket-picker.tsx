import { useMemo } from 'react';

import type { BucketInfo } from './api-client';
import { useRegisterCommands } from './commands/registry';
import type { Command } from './commands/types';
import { HoverRow } from './suite-page';
import { merge, styles } from './theme';

export function BucketPicker(props: {
  readonly buckets: readonly BucketInfo[];
  readonly onOpen: (bucketId: string) => void;
}) {
  const { buckets, onOpen } = props;
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
    <div style={styles.suitePage}>
      <header style={styles.suiteHeader}>
        <h1 style={styles.suiteH1}>simulation-report</h1>
        <span style={styles.meta}>
          {buckets.length} bucket{buckets.length === 1 ? '' : 's'}
        </span>
        <span style={styles.kbdHint}>⌘K</span>
      </header>
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
  );
}

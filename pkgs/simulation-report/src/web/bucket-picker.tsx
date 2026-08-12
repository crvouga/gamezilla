import { useMemo } from 'react';

import type { BucketInfo } from './api-client';
import { useRegisterCommands } from './commands/registry';
import type { Command } from './commands/types';

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
    <div className="suite-page">
      <header>
        <h1>simulation-report</h1>
        <span className="meta">
          {buckets.length} bucket{buckets.length === 1 ? '' : 's'}
        </span>
        <span className="kbd-hint">⌘K</span>
      </header>
      {buckets.length === 0 ? (
        <p className="empty">No buckets configured.</p>
      ) : (
        <table className="suite-table">
          <thead>
            <tr>
              <th>Bucket</th>
              <th>Id</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b) => (
              <tr key={b.id} onClick={() => onOpen(b.id)}>
                <td className="test-id">{b.label}</td>
                <td className="meta">{b.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

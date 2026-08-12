import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import type { RunSummary } from '../types';
import { useRegisterCommands } from './commands/registry';
import type { Command } from './commands/types';
import { HoverRow } from './suite-page';
import { badgeStyle, merge, styles, useHoverStyle } from './theme';

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
  useRunsCommands({ keepLast, runs, onBack, onKeepLast, onOpenRun, setBusy });

  return (
    <div style={styles.suitePage}>
      <RunsHeader
        bucketId={bucketId}
        bucketLabel={bucketLabel}
        runCount={runs.length}
        generation={generation}
        onBack={onBack}
      />
      <PruneBar
        keepLast={keepLast}
        busy={busy}
        onKeepLastChange={setKeepLast}
        onPrune={() => {
          setBusy(true);
          void onKeepLast(keepLast).finally(() => setBusy(false));
        }}
      />
      <RunsTable
        runs={runs}
        busy={busy}
        onOpenRun={onOpenRun}
        onDeleteRun={(runId) => {
          setBusy(true);
          void onDeleteRun(runId).finally(() => setBusy(false));
        }}
      />
    </div>
  );
}

function useRunsCommands(args: {
  readonly keepLast: number;
  readonly runs: readonly RunSummary[];
  readonly onBack: () => void;
  readonly onKeepLast: (n: number) => Promise<void>;
  readonly onOpenRun: (runId: string) => void;
  readonly setBusy: (busy: boolean) => void;
}) {
  const { keepLast, runs, onBack, onKeepLast, onOpenRun, setBusy } = args;
  const commands = useMemo((): Command[] => {
    const list: Command[] = [
      {
        id: 'nav.buckets',
        label: 'Back to buckets',
        section: 'Navigation',
        shortcut: 'Backspace',
        match: (e) => e.key === 'Backspace',
        run: onBack,
      },
      {
        id: 'runs.prune',
        label: `Prune keep last ${keepLast}`,
        section: 'Runs',
        run: () => {
          setBusy(true);
          void onKeepLast(keepLast).finally(() => setBusy(false));
        },
      },
    ];
    for (const r of runs.slice(0, 9)) {
      list.push({
        id: `run.open.${r.id}`,
        label: `Open run ${r.id}`,
        section: 'Runs',
        run: () => onOpenRun(r.id),
      });
    }
    return list;
  }, [keepLast, onBack, onKeepLast, onOpenRun, runs, setBusy]);
  useRegisterCommands(commands);
}

function RunsHeader(props: {
  readonly bucketId: string;
  readonly bucketLabel: string;
  readonly runCount: number;
  readonly generation: number;
  readonly onBack: () => void;
}) {
  const { bucketId, bucketLabel, runCount, generation, onBack } = props;
  const back = useHoverStyle(styles.back, styles.backHover);
  return (
    <header style={styles.suiteHeader}>
      <button
        type="button"
        style={back.style}
        onClick={onBack}
        onMouseEnter={back.onMouseEnter}
        onMouseLeave={back.onMouseLeave}
      >
        ← Buckets
      </button>
      <h1 style={styles.suiteH1}>{bucketLabel}</h1>
      <span style={styles.meta}>
        {bucketId} · {runCount} run{runCount === 1 ? '' : 's'} · gen{' '}
        {generation}
      </span>
      <span style={styles.kbdHint}>⌘K</span>
    </header>
  );
}

function PruneBar(props: {
  readonly keepLast: number;
  readonly busy: boolean;
  readonly onKeepLastChange: (n: number) => void;
  readonly onPrune: () => void;
}) {
  const { keepLast, busy, onKeepLastChange, onPrune } = props;
  const pruneBtn = useHoverStyle(
    merge(styles.btn, busy && styles.btnDisabled),
    styles.btnHover,
    busy
  );
  return (
    <div style={styles.pruneBar}>
      <label>
        Keep last
        <input
          type="number"
          min={0}
          value={keepLast}
          style={styles.pruneInput}
          onChange={(e) => onKeepLastChange(Number(e.target.value) || 0)}
        />
      </label>
      <button
        type="button"
        style={pruneBtn.style}
        disabled={busy}
        onMouseEnter={pruneBtn.onMouseEnter}
        onMouseLeave={pruneBtn.onMouseLeave}
        onClick={onPrune}
      >
        Prune
      </button>
    </div>
  );
}

function RunsTable(props: {
  readonly runs: readonly RunSummary[];
  readonly busy: boolean;
  readonly onOpenRun: (runId: string) => void;
  readonly onDeleteRun: (runId: string) => void;
}) {
  const { runs, busy, onOpenRun, onDeleteRun } = props;
  return (
    <table style={styles.suiteTable}>
      <thead>
        <tr>
          <th style={styles.th}>Run</th>
          <th style={styles.th}>Status</th>
          <th style={styles.th}>Updated</th>
          <th style={styles.th}>Tests</th>
          <th style={styles.th}>Frames</th>
          <th style={styles.th} />
        </tr>
      </thead>
      <tbody>
        {runs.length === 0 ? (
          <tr>
            <td colSpan={6} style={styles.empty}>
              No runs yet. Write reports with{' '}
              <code>report: {'{ store, testId }'}</code>.
            </td>
          </tr>
        ) : (
          runs.map((r) => (
            <RunRow
              key={r.id}
              run={r}
              busy={busy}
              onOpen={() => onOpenRun(r.id)}
              onDelete={() => onDeleteRun(r.id)}
            />
          ))
        )}
      </tbody>
    </table>
  );
}

function RunRow(props: {
  readonly run: RunSummary;
  readonly busy: boolean;
  readonly onOpen: () => void;
  readonly onDelete: () => void;
}): ReactNode {
  const { run: r, busy, onOpen, onDelete } = props;
  const del = useHoverStyle(
    merge(styles.btn, busy && styles.btnDisabled),
    styles.btnHover,
    busy
  );
  return (
    <HoverRow>
      <td
        style={merge(styles.td, styles.testId, { cursor: 'pointer' })}
        onClick={onOpen}
      >
        {r.id}
      </td>
      <td style={styles.td}>
        <span style={badgeStyle(r.status)}>{r.status.toUpperCase()}</span>
      </td>
      <td style={styles.td}>{formatUpdated(r.updatedAtMs)}</td>
      <td style={styles.td}>{r.testCount}</td>
      <td style={styles.td}>{r.frameCount}</td>
      <td style={styles.td}>
        <button
          type="button"
          style={del.style}
          disabled={busy}
          onMouseEnter={del.onMouseEnter}
          onMouseLeave={del.onMouseLeave}
          onClick={onDelete}
        >
          Delete
        </button>
      </td>
    </HoverRow>
  );
}

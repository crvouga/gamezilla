import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';

import type { RunSummary, SuiteTestSummary } from '../types';
import type { BucketInfo } from './api-client';
import { useRegisterCommands } from './commands/registry';
import type { Command } from './commands/types';
import { NavBreadcrumb } from './nav-breadcrumb';
import { ReportHeader } from './report-header';
import type { ReportNavState } from './router';
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
  readonly nav: ReportNavState;
  readonly buckets: readonly BucketInfo[];
  readonly tests: readonly SuiteTestSummary[];
  readonly bucketId: string;
  readonly runs: readonly RunSummary[];
  readonly generation: number;
  readonly onBack: () => void;
  readonly onNav: (nav: ReportNavState) => void;
  readonly onOpenRun: (runId: string) => void;
  readonly onOpenLatest: () => void;
  readonly onDeleteRun: (runId: string) => Promise<void>;
  readonly onKeepLast: (n: number) => Promise<void>;
}) {
  const {
    nav,
    buckets,
    tests,
    bucketId,
    runs,
    generation,
    onBack,
    onNav,
    onOpenRun,
    onOpenLatest,
    onDeleteRun,
    onKeepLast,
  } = props;
  const [keepLast, setKeepLast] = useState(5);
  const [busy, setBusy] = useState(false);
  useRunsCommands({
    keepLast,
    runs,
    onBack,
    onKeepLast,
    onOpenRun,
    onOpenLatest,
    setBusy,
  });
  const latest = useHoverStyle(styles.btn, styles.btnHover);

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
        meta={`${bucketId} · ${runs.length} run${runs.length === 1 ? '' : 's'} · gen ${generation}`}
      />
      <div style={styles.appBody}>
        <div style={styles.pruneBar}>
          <button
            type="button"
            style={merge(latest.style, styles.btn, {
              borderColor: '#3a547a',
              background: '#1a2333',
              color: '#82aaff',
            })}
            onMouseEnter={latest.onMouseEnter}
            onMouseLeave={latest.onMouseLeave}
            onClick={onOpenLatest}
          >
            Open latest run
          </button>
        </div>
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
    </div>
  );
}

function useRunsCommands(args: {
  readonly keepLast: number;
  readonly runs: readonly RunSummary[];
  readonly onBack: () => void;
  readonly onKeepLast: (n: number) => Promise<void>;
  readonly onOpenRun: (runId: string) => void;
  readonly onOpenLatest: () => void;
  readonly setBusy: (busy: boolean) => void;
}) {
  const {
    keepLast,
    runs,
    onBack,
    onKeepLast,
    onOpenRun,
    onOpenLatest,
    setBusy,
  } = args;
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
        id: 'run.open.latest',
        label: 'Open latest run',
        section: 'Runs',
        shortcut: 'L',
        match: (e) => e.key === 'l' && !e.metaKey && !e.ctrlKey,
        run: onOpenLatest,
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
  }, [keepLast, onBack, onKeepLast, onOpenLatest, onOpenRun, runs, setBusy]);
  useRegisterCommands(commands);
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

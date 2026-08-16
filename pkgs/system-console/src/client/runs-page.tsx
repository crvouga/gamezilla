import {
  Badge,
  Box,
  Button,
  createMemoryPageLoader,
  DataTable,
  type DataTableColumn,
  type DataTableOrderDir,
  Pressable,
  ScrollView,
  Text,
  TextInput,
} from '@pkgs/ui';
import { useCallback, useMemo, useState } from 'react';

import type { RunSummary, SuiteTestSummary } from '../types';
import type { BucketInfo } from './api-client';
import { NavBreadcrumb } from './nav-breadcrumb';
import { ReportHeader } from './report-header';
import type { ReportNavState } from './router';
import {
  appBodyFrameSx,
  appShellSx,
  statusBadgeIntent,
  testIdSx,
  useAppBodyContentSx,
} from './tokens';

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

function compareRuns(
  a: RunSummary,
  b: RunSummary,
  orderBy: string,
  orderDir: DataTableOrderDir
): number {
  const dir = orderDir === 'asc' ? 1 : -1;
  if (orderBy === 'updated') return (a.updatedAtMs - b.updatedAtMs) * dir;
  if (orderBy === 'tests') return (a.testCount - b.testCount) * dir;
  if (orderBy === 'frames') return (a.frameCount - b.frameCount) * dir;
  if (orderBy === 'status') return a.status.localeCompare(b.status) * dir;
  return a.id.localeCompare(b.id) * dir;
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
    onNav,
    onOpenRun,
    onOpenLatest,
    onDeleteRun,
    onKeepLast,
  } = props;
  const [keepLast, setKeepLast] = useState(5);
  const [busy, setBusy] = useState(false);
  const bodySx = useAppBodyContentSx();

  const loadPage = useMemo(
    () => createMemoryPageLoader(() => runs, compareRuns),
    [runs]
  );

  const handleDelete = useCallback(
    (runId: string) => {
      setBusy(true);
      void onDeleteRun(runId).finally(() => setBusy(false));
    },
    [onDeleteRun]
  );

  const columns = useMemo(
    () => buildRunColumns({ busy, onOpenRun, onDeleteRun: handleDelete }),
    [busy, onOpenRun, handleDelete]
  );

  return (
    <Box sx={appShellSx}>
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
      <ScrollView frameSx={appBodyFrameSx} sx={bodySx}>
        <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2.5 }}>
          <Button title="Open latest run" size="sm" onPress={onOpenLatest} />
        </Box>
        <PruneBar
          keepLast={keepLast}
          busy={busy}
          onKeepLastChange={setKeepLast}
          onPrune={() => {
            setBusy(true);
            void onKeepLast(keepLast).finally(() => setBusy(false));
          }}
        />
        <Box sx={{ flex: 1, minHeight: 280, alignSelf: 'stretch' }}>
          <DataTable
            columns={columns}
            loadPage={loadPage}
            getRowId={(r) => r.id}
            sourceKey={generation}
            pageSize={50}
            defaultOrderBy="updated"
            defaultOrderDir="desc"
            emptyTitle="No runs yet"
            emptyBody="Write reports with report:"
            density="compact"
          />
        </Box>
      </ScrollView>
    </Box>
  );
}

function buildRunColumns(args: {
  readonly busy: boolean;
  readonly onOpenRun: (runId: string) => void;
  readonly onDeleteRun: (runId: string) => void;
}): DataTableColumn<RunSummary>[] {
  const { busy, onOpenRun, onDeleteRun } = args;
  return [
    {
      id: 'run',
      header: 'Run',
      width: 160,
      sortable: true,
      cell: (r) => (
        <Pressable onPress={() => onOpenRun(r.id)}>
          <Text sx={testIdSx} label={r.id} />
        </Pressable>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 100,
      sortable: true,
      cell: (r) => (
        <Badge
          label={r.status.toUpperCase()}
          intent={statusBadgeIntent(r.status)}
          size="sm"
        />
      ),
    },
    {
      id: 'updated',
      header: 'Updated',
      width: 180,
      sortable: true,
      getValue: (r) => formatUpdated(r.updatedAtMs),
    },
    {
      id: 'tests',
      header: 'Tests',
      width: 72,
      sortable: true,
      getValue: (r) => r.testCount,
    },
    {
      id: 'frames',
      header: 'Frames',
      width: 72,
      sortable: true,
      getValue: (r) => r.frameCount,
    },
    {
      id: 'action',
      header: '',
      width: 88,
      cell: (r) => (
        <Button
          title="Delete"
          size="sm"
          intent="danger"
          variant="outline"
          disabled={busy}
          onPress={() => onDeleteRun(r.id)}
        />
      ),
    },
  ];
}

function PruneBar(props: {
  readonly keepLast: number;
  readonly busy: boolean;
  readonly onKeepLastChange: (n: number) => void;
  readonly onPrune: () => void;
}) {
  const { keepLast, busy, onKeepLastChange, onPrune } = props;
  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2.5 }}>
      <Text sx={{ color: 'text', fontSize: 12 }} label="Keep last" />
      <TextInput
        keyboardType="number-pad"
        value={String(keepLast)}
        sx={{ width: 64 }}
        onChangeText={(text) => onKeepLastChange(Number(text) || 0)}
      />
      <Button
        title="Prune"
        size="sm"
        intent="neutral"
        variant="outline"
        disabled={busy}
        onPress={onPrune}
      />
    </Box>
  );
}

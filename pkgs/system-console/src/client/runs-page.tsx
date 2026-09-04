import {
  Badge,
  Box,
  Button,
  createMemoryPageLoader,
  DataTable,
  type DataTableColumn,
  type DataTableOrderDir,
  IconButton,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  Trash2Icon,
  useTheme,
} from '@pkgs/ui';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useMemo,
  useState,
} from 'react';

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

async function deleteRunsSequential(
  ids: readonly string[],
  onDeleteRun: (runId: string) => Promise<void>
): Promise<void> {
  for (const id of ids) {
    await onDeleteRun(id);
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
  const bodySx = useAppBodyContentSx();
  const state = useRunsPageState(props);

  return (
    <Box sx={appShellSx}>
      <ReportHeader
        breadcrumb={
          <NavBreadcrumb
            nav={props.nav}
            buckets={props.buckets}
            runs={props.runs}
            tests={props.tests}
            onNav={props.onNav}
          />
        }
        meta={`${props.bucketId} · ${props.runs.length} run${props.runs.length === 1 ? '' : 's'} · gen ${props.generation}`}
      />
      <ScrollView frameSx={appBodyFrameSx} sx={bodySx}>
        <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2.5 }}>
          <Button
            title="Open latest run"
            size="sm"
            onPress={props.onOpenLatest}
          />
        </Box>
        <PruneBar
          keepLast={state.keepLast}
          busy={state.busy}
          selectedCount={state.selectedKeys.length}
          onKeepLastChange={state.setKeepLast}
          onPrune={state.handlePrune}
          onDeleteSelected={state.handleDeleteSelected}
        />
        <Box sx={{ flex: 1, minHeight: 280, alignSelf: 'stretch' }}>
          <DataTable
            columns={state.columns}
            loadPage={state.loadPage}
            getRowId={(r) => r.id}
            sourceKey={props.generation}
            pageSize={50}
            defaultOrderBy="updated"
            defaultOrderDir="desc"
            emptyTitle="No runs yet"
            emptyBody="Write reports with report:"
            density="compact"
            selectionMode="multiple"
            selectedKeys={state.selectedKeys}
            onSelectedKeysChange={state.setSelectedKeys}
          />
        </Box>
      </ScrollView>
    </Box>
  );
}

function useRunsPageState(props: {
  readonly runs: readonly RunSummary[];
  readonly onOpenRun: (runId: string) => void;
  readonly onDeleteRun: (runId: string) => Promise<void>;
  readonly onKeepLast: (n: number) => Promise<void>;
}) {
  const { runs, onOpenRun, onDeleteRun, onKeepLast } = props;
  const theme = useTheme();
  const [keepLast, setKeepLast] = useState(5);
  const [busy, setBusy] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<readonly string[]>([]);

  const loadPage = useMemo(
    () => createMemoryPageLoader(() => runs, compareRuns),
    [runs]
  );

  const handleDelete = useCallback(
    (runId: string) => {
      setBusy(true);
      void onDeleteRun(runId)
        .then(() => setSelectedKeys((prev) => prev.filter((k) => k !== runId)))
        .finally(() => setBusy(false));
    },
    [onDeleteRun]
  );

  const handleDeleteSelected = useCallback(() => {
    if (selectedKeys.length === 0) return;
    const ids = [...selectedKeys];
    setBusy(true);
    void deleteRunsSequential(ids, onDeleteRun)
      .then(() => setSelectedKeys([]))
      .finally(() => setBusy(false));
  }, [onDeleteRun, selectedKeys]);

  const handlePrune = useCallback(() => {
    setBusy(true);
    void onKeepLast(keepLast).finally(() => setBusy(false));
  }, [keepLast, onKeepLast]);

  const columns = useMemo(
    () =>
      buildRunColumns({
        busy,
        iconColor: theme.colors.icon,
        onOpenRun,
        onDeleteRun: handleDelete,
      }),
    [busy, theme.colors.icon, onOpenRun, handleDelete]
  );

  return {
    keepLast,
    setKeepLast,
    busy,
    selectedKeys,
    setSelectedKeys,
    loadPage,
    columns,
    handlePrune,
    handleDeleteSelected,
  };
}

function buildRunColumns(args: {
  readonly busy: boolean;
  readonly iconColor: string;
  readonly onOpenRun: (runId: string) => void;
  readonly onDeleteRun: (runId: string) => void;
}): DataTableColumn<RunSummary>[] {
  const { busy, iconColor, onOpenRun, onDeleteRun } = args;
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
      width: 44,
      align: 'end',
      cell: (r) => (
        <IconButton
          label="Delete"
          size={28}
          background="surface"
          tooltip="hover"
          disabled={busy}
          onPress={() => onDeleteRun(r.id)}
        >
          <Trash2Icon size={14} color={iconColor} />
        </IconButton>
      ),
    },
  ];
}

function PruneBar(props: {
  readonly keepLast: number;
  readonly busy: boolean;
  readonly selectedCount: number;
  readonly onKeepLastChange: (n: number) => void;
  readonly onPrune: () => void;
  readonly onDeleteSelected: () => void;
}) {
  const {
    keepLast,
    busy,
    selectedCount,
    onKeepLastChange,
    onPrune,
    onDeleteSelected,
  } = props;
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
      {selectedCount > 0 ? (
        <Button
          title={`Delete ${String(selectedCount)}`}
          size="sm"
          intent="neutral"
          variant="outline"
          disabled={busy}
          onPress={onDeleteSelected}
        />
      ) : null}
    </Box>
  );
}

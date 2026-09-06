import {
  Badge,
  Box,
  createMemoryPageLoader,
  DataTable,
  type DataTableColumn,
  type DataTableOrderDir,
  IconButton,
  Pressable,
  ScrollView,
  Text,
  Trash2Icon,
  useTheme,
} from '@pkgs/ui-rn';
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useMemo,
  useState,
} from 'react';

import type { RunSummary } from '../types';
import { formatRunUpdatedAt } from './frames';
import { ReportHeader } from './report-header';
import {
  appBodyFrameSx,
  appShellSx,
  statusBadgeIntent,
  testIdSx,
  useAppBodyContentSx,
} from './tokens';

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

function clearSelectedKey(
  setSelectedKeys: Dispatch<SetStateAction<readonly string[]>>,
  runId: string
): void {
  setSelectedKeys((prev) => prev.filter((k) => k !== runId));
}

export function RunsPage(props: {
  readonly bucketId: string;
  readonly runs: readonly RunSummary[];
  readonly generation: number;
  readonly onOpenRun: (runId: string) => void;
  readonly onDeleteRun: (runId: string) => Promise<void>;
}) {
  const bodySx = useAppBodyContentSx();
  const state = useRunsPageState(props);

  return (
    <Box sx={appShellSx}>
      <ReportHeader
        meta={`${props.bucketId} · ${props.runs.length} run${props.runs.length === 1 ? '' : 's'} · gen ${props.generation}`}
      />
      <ScrollView frameSx={appBodyFrameSx} sx={bodySx}>
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
}) {
  const { runs, onOpenRun, onDeleteRun } = props;
  const theme = useTheme();
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
        .then(() => clearSelectedKey(setSelectedKeys, runId))
        .finally(() => setBusy(false));
    },
    [onDeleteRun]
  );

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
    selectedKeys,
    setSelectedKeys,
    loadPage,
    columns,
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
      getValue: (r) =>
        formatRunUpdatedAt(r.updatedAtMs) ?? String(r.updatedAtMs),
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

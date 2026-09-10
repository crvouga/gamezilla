import {
  Badge,
  createMemoryPageLoader,
  DataTable,
  type DataTableColumn,
  type DataTableOrderDir,
  IconButton,
  ScrollView,
  Trash2Icon,
  useTheme,
} from '@pkgs/ui';
import { createMemo, createSignal } from 'solid-js';

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
    <div class="box" style={appShellSx}>
      <ReportHeader
        meta={`${props.bucketId} · ${props.runs.length} run${props.runs.length === 1 ? '' : 's'} · gen ${props.generation}`}
      />
      <ScrollView style={appBodyFrameSx} contentStyle={bodySx}>
        <div class="box flex-1 min-h-[280px] self-stretch">
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
        </div>
      </ScrollView>
    </div>
  );
}

function useRunsPageState(props: {
  readonly runs: readonly RunSummary[];
  readonly onOpenRun: (runId: string) => void;
  readonly onDeleteRun: (runId: string) => Promise<void>;
}) {
  const theme = useTheme();
  const [busy, setBusy] = createSignal(false);
  const [selectedKeys, setSelectedKeys] = createSignal<readonly string[]>([]);

  const loadPage = createMemo(() =>
    createMemoryPageLoader(() => props.runs, compareRuns)
  );

  const handleDelete = (runId: string) => {
    setBusy(true);
    void props
      .onDeleteRun(runId)
      .then(() => setSelectedKeys((prev) => prev.filter((k) => k !== runId)))
      .finally(() => setBusy(false));
  };

  const columns = createMemo(() =>
    buildRunColumns({
      busy: busy(),
      iconColor: theme.colors.icon,
      onOpenRun: props.onOpenRun,
      onDeleteRun: handleDelete,
    })
  );

  return {
    get selectedKeys() {
      return selectedKeys();
    },
    setSelectedKeys,
    get loadPage() {
      return loadPage();
    },
    get columns() {
      return columns();
    },
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
        <button
          class="clickable clickableTint"
          type="button"
          onClick={() => onOpenRun(r.id)}
        >
          <p class="text" style={testIdSx}>
            {r.id}
          </p>
        </button>
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
          onClick={() => onDeleteRun(r.id)}
        >
          <Trash2Icon size={14} color={iconColor} />
        </IconButton>
      ),
    },
  ];
}

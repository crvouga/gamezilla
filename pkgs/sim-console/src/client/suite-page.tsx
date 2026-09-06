import {
  Badge,
  Box,
  createMemoryPageLoader,
  DataTable,
  type DataTableColumn,
  type DataTableOrderDir,
  ScrollView,
  Text,
} from '@pkgs/ui';
import { createMemo } from 'solid-js';

import type { SuiteTestSummary } from '../types';
import { formatMs, formatRunUpdatedAt } from './frames';
import { ReportHeader } from './report-header';
import {
  appBodyFrameSx,
  appShellSx,
  statusBadgeIntent,
  testIdSx,
  useAppBodyContentSx,
} from './tokens';

function compareTests(
  a: SuiteTestSummary,
  b: SuiteTestSummary,
  orderBy: string,
  orderDir: DataTableOrderDir
): number {
  const dir = orderDir === 'asc' ? 1 : -1;
  if (orderBy === 'duration') return (a.durationMs - b.durationMs) * dir;
  if (orderBy === 'steps') return (a.stepCount - b.stepCount) * dir;
  if (orderBy === 'frames') return (a.frameCount - b.frameCount) * dir;
  if (orderBy === 'status') return a.status.localeCompare(b.status) * dir;
  return a.testId.localeCompare(b.testId) * dir;
}

const TEST_COLUMNS: DataTableColumn<SuiteTestSummary>[] = [
  {
    id: 'test',
    header: 'Test',
    width: 200,
    sortable: true,
    cell: (tt) => <Text sx={testIdSx} label={tt.testId} />,
  },
  {
    id: 'status',
    header: 'Status',
    width: 100,
    sortable: true,
    cell: (tt) => (
      <Badge
        label={tt.status.toUpperCase()}
        intent={statusBadgeIntent(tt.status)}
        size="sm"
      />
    ),
  },
  {
    id: 'duration',
    header: 'Duration',
    width: 96,
    sortable: true,
    getValue: (tt) => formatMs(tt.durationMs),
  },
  {
    id: 'steps',
    header: 'Steps',
    width: 72,
    sortable: true,
    getValue: (tt) => tt.stepCount,
  },
  {
    id: 'frames',
    header: 'Frames',
    width: 72,
    sortable: true,
    getValue: (tt) => tt.frameCount,
  },
];

export function SuitePage(props: {
  readonly bucketId: string;
  readonly runId: string;
  readonly tests: readonly SuiteTestSummary[];
  /** Manifest / run `updatedAtMs` — shown next to the run id. */
  readonly updatedAtMs?: number | null;
  readonly onOpenTest: (testId: string) => void;
}) {
  const bodySx = useAppBodyContentSx();
  const passed = createMemo(
    () => props.tests.filter((tt) => tt.status === 'passed').length
  );
  const updated = createMemo(() => formatRunUpdatedAt(props.updatedAtMs));
  const runLabel = createMemo(() => {
    const u = updated();
    return u != null ? `${props.runId} · ${u}` : props.runId;
  });

  const loadPage = createMemo(() =>
    createMemoryPageLoader(() => props.tests, compareTests)
  );

  const meta = createMemo(
    () =>
      `${props.bucketId} · ${runLabel()} · ${props.tests.length} test${props.tests.length === 1 ? '' : 's'}${props.tests.length ? ` · ${passed()} passed` : ''}`
  );

  return (
    <Box sx={appShellSx}>
      <ReportHeader meta={meta()} />
      <ScrollView frameSx={appBodyFrameSx} sx={bodySx}>
        <Box sx={{ flex: 1, minHeight: 280, alignSelf: 'stretch' }}>
          <DataTable
            columns={TEST_COLUMNS}
            loadPage={loadPage()}
            getRowId={(tt) => tt.testId}
            sourceKey={`${props.bucketId}:${props.runId}`}
            pageSize={50}
            defaultOrderBy="test"
            emptyTitle="No tests in this run yet"
            density="compact"
            onRowClick={(tt) => props.onOpenTest(tt.testId)}
          />
        </Box>
      </ScrollView>
    </Box>
  );
}

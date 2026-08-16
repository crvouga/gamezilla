import { Card } from '../card';
import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { createMemoryPageLoader } from './create-memory-page-loader';
import { DataTable } from './data-table';
import type { DataTableColumn } from './data-table-types';

type DemoRow = {
  readonly id: string;
  readonly name: string;
  readonly score: number;
  readonly status: string;
};

const ALL_ROWS: readonly DemoRow[] = Array.from({ length: 120 }, (_, i) => ({
  id: `row-${i}`,
  name: `Item ${i + 1}`,
  score: (i * 17) % 100,
  status: i % 3 === 0 ? 'open' : i % 3 === 1 ? 'done' : 'blocked',
}));

const COLUMNS: DataTableColumn<DemoRow>[] = [
  {
    id: 'name',
    header: 'Name',
    width: 160,
    sortable: true,
    getValue: (r) => r.name,
  },
  {
    id: 'score',
    header: 'Score',
    width: 88,
    sortable: true,
    align: 'end',
    getValue: (r) => r.score,
  },
  {
    id: 'status',
    header: 'Status',
    width: 100,
    sortable: true,
    getValue: (r) => r.status,
  },
];

function compareDemo(
  a: DemoRow,
  b: DemoRow,
  orderBy: string,
  orderDir: 'asc' | 'desc'
): number {
  const dir = orderDir === 'asc' ? 1 : -1;
  if (orderBy === 'score') return (a.score - b.score) * dir;
  if (orderBy === 'status') return a.status.localeCompare(b.status) * dir;
  return a.name.localeCompare(b.name) * dir;
}

const loadPage = createMemoryPageLoader(() => ALL_ROWS, compareDemo);

export default function DataTableExample() {
  return (
    <ExampleRoot>
      <Text
        variant="label"
        label="Loader-driven table (120 rows, page size 20, cached pages)"
      />
      <Card elevation={0} sx={{ height: 360, overflow: 'hidden', p: 0 }}>
        <DataTable
          columns={COLUMNS}
          loadPage={loadPage}
          getRowId={(r) => r.id}
          sourceKey="demo"
          pageSize={20}
          defaultOrderBy="name"
          emptyTitle="No demo rows"
          density="compact"
        />
      </Card>
    </ExampleRoot>
  );
}

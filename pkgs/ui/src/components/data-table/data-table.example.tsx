import { useState } from 'react';
import { useTheme } from '../../theme';
import { Card } from '../card';
import { ExampleRoot } from '../explorer/example-root';
import { IconButton } from '../icon-button';
import { Trash2Icon } from '../icons';
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
  const theme = useTheme();
  const [selectedKeys, setSelectedKeys] = useState<readonly string[]>([]);
  const columns: DataTableColumn<DemoRow>[] = [
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
          onPress={() =>
            setSelectedKeys((prev) => prev.filter((k) => k !== r.id))
          }
        >
          <Trash2Icon size={14} color={theme.colors.icon} />
        </IconButton>
      ),
    },
  ];

  return (
    <ExampleRoot>
      <Text
        variant="label"
        label="Loader-driven table (120 rows, multi-select, quiet row actions)"
      />
      <Text
        variant="caption"
        sx={{ opacity: 0.75 }}
        label={
          selectedKeys.length === 0
            ? 'None selected'
            : `${selectedKeys.length} selected`
        }
      />
      <Card elevation={0} sx={{ height: 360, overflow: 'hidden', p: 0 }}>
        <DataTable
          columns={columns}
          loadPage={loadPage}
          getRowId={(r) => r.id}
          sourceKey="demo"
          pageSize={20}
          defaultOrderBy="name"
          emptyTitle="No demo rows"
          density="compact"
          selectionMode="multiple"
          selectedKeys={selectedKeys}
          onSelectedKeysChange={setSelectedKeys}
        />
      </Card>
    </ExampleRoot>
  );
}

/** @jsxImportSource solid-js */

import { DataTable } from '@pkgs/ui-devtools-client-ts/data-table';
import { createMemoryPageLoader } from '@pkgs/ui-devtools-shared-ts/create-memory-page-loader';
import type {
  DataTableColumn,
  DataTableOrderDir,
} from '@pkgs/ui-devtools-shared-ts/data-table-types';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import { Trash2Icon } from '@pkgs/ui-root-client-ts/icons';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../../ui-root-client-ts/storybook/fixtures/example-root';

type DemoRow = {
  readonly id: string;
  readonly name: string;
  readonly score: number;
  readonly status: string;
};

const STATUSES = ['open', 'done', 'blocked'] as const;

const ALL_ROWS: readonly DemoRow[] = Array.from({ length: 120 }, (_, i) => ({
  id: `row-${i}`,
  name: `Item ${i + 1}`,
  score: (i * 17) % 100,
  status: STATUSES[i % STATUSES.length] ?? 'open',
}));

function compareDemo(
  a: DemoRow,
  b: DemoRow,
  orderBy: string,
  orderDir: DataTableOrderDir
): number {
  const dir = orderDir === 'asc' ? 1 : -1;
  if (orderBy === 'score') return (a.score - b.score) * dir;
  if (orderBy === 'status') return a.status.localeCompare(b.status) * dir;
  return a.name.localeCompare(b.name) * dir;
}

const loadPage = createMemoryPageLoader(() => ALL_ROWS, compareDemo);

function buildColumns(
  deselect: (id: string) => void
): DataTableColumn<DemoRow>[] {
  return [
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
          onClick={() => deselect(r.id)}
        >
          <Trash2Icon size={14} color="icon" />
        </IconButton>
      ),
    },
  ];
}

export default function DataTableExample(): JSX.Element {
  const [selectedKeys, setSelectedKeys] = createSignal<readonly string[]>([]);
  const columns = buildColumns((id) =>
    setSelectedKeys((prev) => prev.filter((k) => k !== id))
  );
  const summary = (): string =>
    selectedKeys().length === 0
      ? 'None selected'
      : `${selectedKeys().length} selected`;

  return (
    <ExampleRoot>
      <label class="text textLabel">
        {'Loader-driven table (120 rows, multi-select, quiet row actions)'}
      </label>
      <p class="text textCaption opacity-75">{summary()}</p>
      <div class="card h-90 overflow-hidden p-0">
        <DataTable<DemoRow>
          columns={columns}
          loadPage={loadPage}
          getRowId={(r) => r.id}
          sourceKey="demo"
          pageSize={20}
          defaultOrderBy="name"
          emptyTitle="No demo rows"
          density="compact"
          selectionMode="multiple"
          selectedKeys={selectedKeys()}
          onSelectedKeysChange={setSelectedKeys}
        />
      </div>
    </ExampleRoot>
  );
}

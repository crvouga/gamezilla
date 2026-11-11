import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  EMPTY_OVERVIEW,
  OVERVIEW,
  worker,
} from './synthetic-population.example';
import { SyntheticPopulationWorkersScreenView } from './synthetic-population-workers-screen-view';

const meta = {
  id: 'screens-admin-synthetic-population-workers',
  title: 'Screens/Admin/Synthetic population workers',
  component: SyntheticPopulationWorkersScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['overview', 'denial'] },
  },
  args: {
    overview: OVERVIEW,
    loading: false,
    failed: false,
    onRefresh: fn(),
  },
} satisfies Meta<typeof SyntheticPopulationWorkersScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Three workers: ready, draining an older version, and unreachable. */
export const Populated: Story = {};

/** The first read is under way. */
export const Loading: Story = { args: { overview: undefined, loading: true } };

/** A live update is rereading: the rows stay and the header says so. */
export const Refreshing: Story = { args: { loading: true } };

/** The first read failed: the retry reads again. */
export const Failed: Story = { args: { overview: undefined, failed: true } };

/** A later read failed: the last workers read stay under the retry. */
export const FailedKeepsRows: Story = { args: { failed: true } };

/** No worker has reported a heartbeat yet. */
export const Empty: Story = { args: { overview: EMPTY_OVERVIEW } };

/** Many workers, sorted by the column the reader chose. */
export const ManyWorkers: Story = {
  args: {
    overview: {
      ...OVERVIEW,
      workers: [
        ...OVERVIEW.workers,
        ...[1, 2, 3, 4, 5].map((index) =>
          worker(`4f0c2d1e-9a7b-4c3d-8e2f-00000000000${index}`, {
            lease_failures: index,
            memory_bytes: 268_435_456 * index,
          })
        ),
      ],
    },
  },
};

/** A person without permission: the denial replaces the screen. */
export const Denied: Story = {
  args: {
    overview: undefined,
    denial: {
      icon: KeyRoundIcon,
      title: 'Not available',
      dataSet: { testid: 'synthetic-population-denied', reason: 'not_granted' },
    },
  },
};

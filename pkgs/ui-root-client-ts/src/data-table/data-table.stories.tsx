import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  LivePlayerTable,
  PLAYER_TABLE,
  PLAYERS,
  type PlayerTableProps,
} from './data-table.example';
import { DataTable } from './index';

const meta = {
  id: 'components-data-display-datatable',
  title: 'Organisms/DataTable',
  component: DataTable,
  tags: ['autodocs', 'viewport-responsive'],
  parameters: {
    controls: { exclude: ['columns', 'rowKey', 'rowLabel'] },
  },
  args: {
    ...PLAYER_TABLE,
    onRowPress: fn().mockName('onRowPress'),
  },
  render: (args) => <DataTable {...(args as PlayerTableProps)} />,
} satisfies Meta;
export default meta;
type Story = StoryObj<PlayerTableProps>;

/**
 * A collection ready to use: count and actions, search and filter, facts,
 * then sortable full-width columns on a desktop and stacked cards on a
 * phone; rows open what they name.
 */
export const Populated: Story = {};

/** The first read is under way: the loading state stands in for the rows. */
export const Loading: Story = {
  args: { rows: undefined, loading: true, count: undefined, facts: [] },
};

/** A reread is under way: the rows stay and the header says it is updating. */
export const Refreshing: Story = { args: { loading: true } };

/** The first read failed: the failure replaces the rows, with a retry. */
export const Failed: Story = {
  args: {
    rows: undefined,
    count: undefined,
    facts: [],
    failure: {
      title: 'Players could not be loaded.',
      body: 'Check your connection and try again.',
      onRetry: fn().mockName('onRetry'),
    },
  },
};

/** A later read failed: the last rows read stay in view under the retry. */
export const FailedKeepsRows: Story = {
  args: {
    failure: {
      title: 'Players could not be refreshed.',
      body: 'Showing the last list read. Check your connection and try again.',
      onRetry: fn().mockName('onRetry'),
    },
  },
};

/** Nothing to show: the empty state says what will fill it. */
export const Empty: Story = {
  args: { rows: [], count: '0 players', facts: [] },
};

/** A collection the server pages: where the reader is, Previous and Next. */
export const Paged: Story = {
  args: {
    paging: {
      label: 'Page 2',
      onPrevious: fn().mockName('onPrevious'),
      onNext: fn().mockName('onNext'),
    },
  },
};

/** Sorted by rating, highest first, from the column the reader chose. */
export const SortedDescending: Story = {
  args: { defaultSort: { key: 'rating', direction: 'descending' } },
};

/** Long names wrap inside their cell instead of pushing columns off screen. */
export const LongContent: Story = {
  args: {
    rows: [
      {
        id: 'p9',
        name: 'the_grand_strategist_of_rainy_tuesday_evenings',
        status: 'online',
        game: 'Battleship: Salvo with extended fleets and fog of war',
        rating: 2045,
      },
      ...PLAYERS,
    ],
  },
};

/** Read-only rows, no toolbar and no actions: just the collection. */
export const ReadOnly: Story = {
  args: {
    onRowPress: undefined,
    search: undefined,
    filter: undefined,
    actions: [],
    facts: [],
  },
};

/** A working table: type to search, choose a filter, press a row. */
export const Interactive: Story = {
  render: () => <LivePlayerTable />,
};

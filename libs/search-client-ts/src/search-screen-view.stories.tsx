import { UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SearchScreenView } from './search-screen-view';
import { StoryUserRow, storyResult } from './search-screen-view.example';

const RESULTS = [
  storyResult(1, 'jordan'),
  storyResult(2, 'jordan_plays'),
  storyResult(3, 'jordy'),
];

const IDLE = {
  searching: false,
  needsConnection: false,
  failed: false,
  results: [],
};

const meta = {
  id: 'screens-search-people',
  title: 'Screens/Search/Search',
  component: SearchScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['search', 'denial', 'renderUserRow'] },
  },
  args: {
    query: '',
    recentQueries: [],
    search: IDLE,
    renderUserRow: (user, query) => <StoryUserRow user={user} query={query} />,
    onQueryChange: fn(),
    onSelectRecent: fn(),
    onClearRecent: fn(),
  },
} satisfies Meta<typeof SearchScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing typed and no history: an invitation to find people. */
export const Idle: Story = {};

/** Nothing typed: recent searches, each one tap from running again. */
export const RecentSearches: Story = {
  args: { recentQueries: ['jordan', 'morgan', 'robin_42'] },
};

/** Typing, or waiting on the answer: one activity indicator. */
export const Searching: Story = {
  args: { query: 'jor', search: { ...IDLE, searching: true } },
};

/**
 * People whose username starts with the query, in one panel: what follows
 * the typed "jor" is emphasised so similar handles read apart. Each row ends
 * in what the viewer can do (Add Friend) or where they stand (a Friends or
 * Requested tag, Cancel beside a request). The panel sits on the search
 * field's inset.
 */
export const Results: Story = {
  args: { query: 'jor', search: { ...IDLE, results: RESULTS } },
};

/** Nobody matched: the query is repeated and a next step suggested. */
export const NoResults: Story = { args: { query: 'zzz' } };

/** Offline with nobody on this device: search needs a connection. */
export const Offline: Story = {
  args: { query: 'jor', search: { ...IDLE, needsConnection: true } },
};

/** Offline, people already on this device are shown, with a caution. */
export const OfflineWithLocalResults: Story = {
  args: {
    query: 'jor',
    search: { ...IDLE, needsConnection: true, results: RESULTS.slice(0, 1) },
  },
};

/** The server could not answer: search needs a connection, and says why. */
export const Failed: Story = {
  args: {
    query: 'jor',
    search: { ...IDLE, needsConnection: true, failed: true },
  },
};

/** A long query is echoed in full in the empty state. */
export const LongQuery: Story = {
  args: { query: 'a_really_long_username_that_keeps_going_and_going' },
};

/** A guest may not search people: the sign-in way forward, once they type. */
export const Denied: Story = {
  args: {
    query: 'jor',
    denial: {
      icon: UsersIcon,
      title: 'Sign in to search for people',
      body: 'Find friends by username once you have an account.',
      action: { label: 'Sign in', onPress: fn() },
      dataSet: { testid: 'search-denied', reason: 'requires_account' },
    },
  },
};

/** A recent search runs again when pressed. */
export const SelectRecent: Story = {
  args: { recentQueries: ['jordan', 'morgan'] },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('morgan'));
    await expect(args.onSelectRecent).toHaveBeenCalledWith('morgan');
  },
};

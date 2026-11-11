import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  face,
  ONLINE_NOW,
  ONLINE_NOW_SCREEN,
  onlineEntry,
} from './online-now.example';
import { OnlineNowScreenView } from './online-now-screen-view';

const meta = {
  id: 'screens-admin-online-now',
  title: 'Screens/Admin/Online now',
  component: OnlineNowScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['denial', 'entries'] },
  },
  args: ONLINE_NOW_SCREEN,
} satisfies Meta<typeof OnlineNowScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An operator who may watch: people and Synthetic Users online now in one
 * table, sorted by name, each row opening a live view.
 */
export const Populated: Story = {};

/** A viewer who may not watch live: the same table, rows do not open. */
export const ViewOnly: Story = { args: { canWatch: false } };

/** Showing only people online now: Synthetic Users are hidden. */
export const PeopleOnly: Story = {
  args: {
    filter: 'people',
    entries: ONLINE_NOW.filter((entry) => entry.kind === 'person'),
  },
};

/** Showing only Synthetic Users online now: people are hidden. */
export const SyntheticUsersOnly: Story = {
  args: {
    filter: 'synthetic',
    entries: ONLINE_NOW.filter((entry) => entry.kind === 'synthetic'),
  },
};

/** A search by name narrows the rows as it is typed. */
export const Searched: Story = { args: { search: 'pla' } };

/** A search nobody matches says so and how to get everyone back. */
export const SearchedNobody: Story = { args: { search: 'zebra' } };

/** Nobody is online now: the table says so and what will appear. */
export const Empty: Story = { args: { entries: [] } };

/** Who is online now is still being read. */
export const Loading: Story = { args: { loading: true, entries: undefined } };

/** A reread is under way: the list stays, the header says it is updating. */
export const Refreshing: Story = { args: { loading: true } };

/** Who is online now could not be read; its own retry asks again. */
export const Failed: Story = { args: { failed: true, entries: undefined } };

/** A later read failed: the last list stays, under a retry. */
export const FailedKeepsList: Story = { args: { failed: true } };

/** Long usernames and game names wrap instead of breaking rows. */
export const LongContent: Story = {
  args: {
    entries: [
      onlineEntry(9, 'the_grand_strategist_of_rainy_tuesday_evenings', {
        avatarConfig: face('thumbs', 'a7c31e90d2b4'),
        place: 'space',
        activity: 'looking',
        game: 'Battleship: Salvo with extended fleets and fog of war',
      }),
      ...ONLINE_NOW,
    ],
  },
};

/** A person without permission: the denial replaces the screen. */
export const Denied: Story = {
  args: {
    entries: undefined,
    denial: {
      icon: KeyRoundIcon,
      title: 'Not available',
      dataSet: { testid: 'observatory-denied', reason: 'not_granted' },
    },
  },
};

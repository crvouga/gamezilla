import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { face, ONLINE_NOW, onlineEntry, onlineNow } from './online-now.example';
import {
  UserObservatoryScreenView,
  type UserObservatoryScreenViewProps,
} from './user-observatory-screen-view';

const meta = {
  id: 'screens-admin-user-observatory',
  title: 'Screens/Admin/User observatory',
  component: UserObservatoryScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['denial', 'onlineNow'] },
  },
  args: {
    canOpenSyntheticUsers: true,
    onOpenSyntheticUsers: fn(),
    onlineNow: onlineNow() as UserObservatoryScreenViewProps['onlineNow'],
  },
} satisfies Meta<typeof UserObservatoryScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An operator's User Observatory: the way into the Synthetic Population
 * panel, then people and Synthetic Users online now, each opening a live
 * view; only Synthetic Users offer a control panel.
 */
export const Populated: Story = {};

/**
 * A viewer who may not watch live, control Synthetic Users or open the
 * Synthetic Population panel: rows do not open and offer no control panel.
 */
export const ViewOnly: Story = {
  args: {
    canOpenSyntheticUsers: false,
    onlineNow: onlineNow({ canWatch: false, canControl: false }),
  },
};

/** Showing only people online now: Synthetic Users are hidden. */
export const PeopleOnly: Story = {
  args: {
    onlineNow: onlineNow({
      filter: 'people',
      entries: ONLINE_NOW.filter((entry) => entry.kind === 'person'),
    }),
  },
};

/** Showing only Synthetic Users online now: people are hidden. */
export const SyntheticUsersOnly: Story = {
  args: {
    onlineNow: onlineNow({
      filter: 'synthetic',
      entries: ONLINE_NOW.filter((entry) => entry.kind === 'synthetic'),
    }),
  },
};

/** Nobody is online now: the list says so and what will appear. */
export const Empty: Story = {
  args: { onlineNow: onlineNow({ entries: [] }) },
};

/** Who is online now is still being read. */
export const Loading: Story = {
  args: { onlineNow: onlineNow({ loading: true, entries: undefined }) },
};

/** Who is online now could not be read; its own retry asks again. */
export const Failed: Story = {
  args: { onlineNow: onlineNow({ failed: true, entries: undefined }) },
};

/** A later read failed: the last list stays, with a retry. */
export const FailedKeepsList: Story = {
  args: { onlineNow: onlineNow({ failed: true }) },
};

/** Long usernames and game names wrap instead of breaking rows. */
export const LongContent: Story = {
  args: {
    onlineNow: onlineNow({
      entries: [
        onlineEntry(9, 'the_grand_strategist_of_rainy_tuesday_evenings', {
          avatarConfig: face('thumbs', 'a7c31e90d2b4'),
          place: 'space',
          activity: 'looking',
          game: 'Battleship: Salvo with extended fleets and fog of war',
        }),
        ...ONLINE_NOW,
      ],
    }),
  },
};

/** A person without permission: the denial replaces the screen. */
export const Denied: Story = {
  args: {
    canOpenSyntheticUsers: false,
    onlineNow: undefined,
    denial: {
      icon: KeyRoundIcon,
      title: 'Not available',
      dataSet: { testid: 'observatory-denied', reason: 'not_granted' },
    },
  },
};

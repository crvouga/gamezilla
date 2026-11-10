import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  CONFIG,
  directory,
  EMPTY_OVERVIEW,
  ONLINE_NOW,
  OVERVIEW,
  onlineEntry,
  onlineNow,
  PAGE,
  userRow,
  worker,
} from './synthetic-population.example';
import { toConfigurationDraft } from './synthetic-population-configuration';
import {
  SyntheticPopulationScreenView,
  type SyntheticPopulationScreenViewProps,
} from './synthetic-population-screen-view';

const meta = {
  id: 'screens-admin-synthetic-population',
  title: 'Screens/Admin/Synthetic population',
  component: SyntheticPopulationScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: {
      exclude: ['overview', 'denial', 'fields', 'directory', 'onlineNow'],
    },
  },
  args: {
    loading: false,
    failed: false,
    overview: OVERVIEW,
    canConfigure: true,
    fields: toConfigurationDraft(CONFIG),
    canSave: true,
    directory: directory() as SyntheticPopulationScreenViewProps['directory'],
    onChangeField: fn(),
    onSave: fn(async () => undefined),
    onRefresh: fn(),
    canControl: true,
    onCommandAll: fn(async () => undefined),
    onlineNow: onlineNow() as SyntheticPopulationScreenViewProps['onlineNow'],
  },
} satisfies Meta<typeof SyntheticPopulationScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * A running population seen by an operator: counts, controls for every
 * Synthetic User, people and Synthetic Users online now (only Synthetic
 * Users offer a control panel), the configuration form, the directory (one
 * paused, one recovering, one recorded before personas) and workers that
 * are ready, draining and unreachable.
 */
export const Populated: Story = {};

/**
 * A viewer without configure, control, inspect or watch: no form, no
 * controls, online-now rows do not open and offer no control panel.
 */
export const ViewOnly: Story = {
  args: {
    canConfigure: false,
    canControl: false,
    directory: directory({ canInspect: false }),
    onlineNow: onlineNow({ canWatch: false, canControl: false }),
  },
};

/** Showing only people online now: Synthetic Users are hidden. */
export const OnlineNowPeopleOnly: Story = {
  args: {
    onlineNow: onlineNow({
      filter: 'people',
      entries: ONLINE_NOW.filter((entry) => entry.kind === 'person'),
    }),
  },
};

/** Showing only Synthetic Users online now: people are hidden. */
export const OnlineNowSyntheticUsersOnly: Story = {
  args: {
    onlineNow: onlineNow({
      filter: 'synthetic',
      entries: ONLINE_NOW.filter((entry) => entry.kind === 'synthetic'),
    }),
  },
};

/** Nobody is online now: the list says so and what will appear. */
export const OnlineNowEmpty: Story = {
  args: { onlineNow: onlineNow({ entries: [] }) },
};

/** Who is online now is still being read. */
export const OnlineNowLoading: Story = {
  args: { onlineNow: onlineNow({ loading: true, entries: undefined }) },
};

/** Who is online now could not be read; its own retry asks again. */
export const OnlineNowFailed: Story = {
  args: { onlineNow: onlineNow({ failed: true, entries: undefined }) },
};

/** A later read failed: the last list stays, with a retry above the fold. */
export const OnlineNowFailedKeepsList: Story = {
  args: { onlineNow: onlineNow({ failed: true }) },
};

/** Long usernames and game names wrap instead of breaking rows. */
export const OnlineNowLongContent: Story = {
  args: {
    onlineNow: onlineNow({
      entries: [
        onlineEntry(5, 'someone_with_a_really_long_username_that_goes_on', {
          place: 'space',
          activity: 'looking',
          game: 'Quoridor on a board with an exceptionally long name',
        }),
        ...ONLINE_NOW,
      ],
    }),
  },
};

/** The first read has not finished; the activity indicator, Refresh and unavailable Save. */
export const Loading: Story = {
  args: { loading: true, overview: undefined, canSave: false },
};

/** A live update is rereading; the last overview stays under the indicator. */
export const Refreshing: Story = { args: { loading: true } };

/** The first read failed; Refresh is the way to try again. */
export const Failed: Story = {
  args: { failed: true, overview: undefined, canSave: false },
};

/** Nothing is running yet: nobody online, empty directory, no workers, no events. */
export const Empty: Story = {
  args: {
    onlineNow: onlineNow({ entries: [] }),
    overview: EMPTY_OVERVIEW,
    fields: toConfigurationDraft(EMPTY_OVERVIEW.config),
    directory: directory({ page: { users: [], nextCursor: null } }),
  },
};

/** The directory's first page is still being read under a known overview. */
export const DirectoryLoading: Story = {
  args: { directory: directory({ loading: true, page: undefined }) },
};

/** The directory could not be read; its own retry asks again. */
export const DirectoryFailed: Story = {
  args: { directory: directory({ failed: true, page: undefined }) },
};

/** A later directory page: both paging actions are offered. */
export const DirectoryPaged: Story = {
  args: {
    directory: directory({
      filter: 'bot',
      paged: true,
      page: { ...PAGE, nextCursor: 'cursor-0002' },
    }),
  },
};

/** Long names, ids and versions wrap or truncate instead of breaking rows. */
export const LongContent: Story = {
  args: {
    overview: {
      ...OVERVIEW,
      groups: [
        {
          activity: 'matchmaking',
          region: 'asia-southeast-singapore-availability-zone-c',
          count: 1,
        },
      ],
      workers: [
        worker('synthetic-population-worker-eu-west-frankfurt-0001-blue', {
          application_version: '2026.03.14-1+build.8f2c1d9e4b7a6c5d',
        }),
      ],
    },
    directory: directory({
      page: {
        users: [
          userRow(5, 'bot_with_a_really_long_username_that_keeps_on_going', {
            activity: 'matchmaking',
          }),
          ...PAGE.users,
        ],
        nextCursor: null,
      },
    }),
  },
};

/** A person without the operator role: the denial replaces the screen. */
export const Denied: Story = {
  args: {
    overview: undefined,
    canConfigure: false,
    canControl: false,
    directory: undefined,
    onlineNow: undefined,
    denial: {
      icon: KeyRoundIcon,
      title: 'Not available',
      dataSet: {
        testid: 'synthetic-population-denied',
        reason: 'not_granted',
      },
    },
  },
};

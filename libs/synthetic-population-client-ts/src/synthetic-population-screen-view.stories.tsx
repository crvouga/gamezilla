import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ONLINE_NOW, onlineEntry, onlineNow } from './online-now.example';
import {
  CONFIG,
  directory,
  EMPTY_OVERVIEW,
  face,
  OVERVIEW,
  PAGE,
  PERSONA,
  userRow,
  withGameNames,
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
  decorators: [withGameNames],
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
 * Users offer a control panel), the configuration form, the directory (each
 * row with its home region, skill level and favorite games; one paused, one
 * recovering, one recorded before personas) and workers that
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
      filter: 'Berlin',
      paged: true,
      page: { ...PAGE, nextCursor: 'cursor-0002' },
    }),
  },
};

/**
 * Each directory row names the persona's favorite games: three, one, or
 * none when no game was on offer as it was provisioned.
 */
export const DirectoryFavoriteGames: Story = {
  args: {
    directory: directory({
      page: {
        users: [
          userRow(5, 'MayaK', {
            region: 'São Paulo, BR',
            persona: {
              ...PERSONA,
              username: 'MayaK',
              avatar: face('lorelei', '3e74be7351be'),
              homeRegion: 'São Paulo, BR',
              favoriteGames: ['backgammon', 'go', 'mancala'],
            },
          }),
          userRow(6, 'mango7', {
            region: 'Lagos, NG',
            activity: 'matchmaking',
            persona: {
              ...PERSONA,
              username: 'mango7',
              avatar: face('miniavs', '059c0be93ca0'),
              homeRegion: 'Lagos, NG',
              skillLevel: 'beginner',
              favoriteGames: ['dominoes'],
            },
          }),
          userRow(7, 'Kenji_irl', {
            region: 'Tokyo, JP',
            persona: {
              ...PERSONA,
              username: 'Kenji_irl',
              avatar: face('notionists', '6e32ed937dae'),
              homeRegion: 'Tokyo, JP',
              skillLevel: 'strong',
              favoriteGames: [],
            },
          }),
        ],
        nextCursor: null,
      },
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
          region:
            'Llanfairpwllgwyngyllgogerychwyrndrobwllllantysiliogogogoch, UK',
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
          userRow(5, 'the_grand_strategist_of_rainy_tuesday_evenings', {
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

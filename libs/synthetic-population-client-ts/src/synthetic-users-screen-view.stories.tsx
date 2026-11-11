import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  EMPTY_OVERVIEW,
  face,
  OVERVIEW,
  PAGE,
  PERSONA,
  USERS,
  userRow,
  withGameNames,
} from './synthetic-population.example';
import { SyntheticUsersScreenView } from './synthetic-users-screen-view';

const meta = {
  id: 'screens-admin-synthetic-users',
  title: 'Screens/Admin/Synthetic users',
  component: SyntheticUsersScreenView,
  tags: ['autodocs'],
  decorators: [withGameNames],
  parameters: {
    appRouter: true,
    controls: { exclude: ['page', 'overview', 'denial', 'controlDenial'] },
  },
  args: {
    search: '',
    onSearch: fn(),
    page: PAGE,
    loading: false,
    failed: false,
    onRetry: fn(),
    pageNumber: 1,
    overview: OVERVIEW,
    canInspect: true,
    onOpenUser: fn(),
    canControl: true,
    onCommandAll: fn(async () => undefined),
  },
} satisfies Meta<typeof SyntheticUsersScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An operator's Synthetic Users: the population's counts, then one row per
 * Synthetic User (one mid-game, one looking for an opponent, one paused,
 * one recovering and recorded before personas), each opening its control
 * panel; pausing or resuming every one is a toolbar action.
 */
export const Populated: Story = {};

/** The first read is under way. */
export const Loading: Story = {
  args: { page: undefined, overview: undefined, loading: true },
};

/** A live update is rereading: the rows stay and the header says so. */
export const Refreshing: Story = { args: { loading: true } };

/** The first read failed: the retry reads again. */
export const Failed: Story = {
  args: { page: undefined, overview: undefined, failed: true },
};

/** A later read failed: the last page stays in view under the retry. */
export const FailedKeepsRows: Story = { args: { failed: true } };

/** Nothing running yet: the table says what will fill it. */
export const Empty: Story = {
  args: { page: { users: [], nextCursor: null }, overview: EMPTY_OVERVIEW },
};

/** A search that matches nobody. */
export const NoMatch: Story = {
  args: { search: 'zzz', page: { users: [], nextCursor: null } },
};

/** The second page of a large population: Previous and Next. */
export const Paged: Story = {
  args: {
    pageNumber: 2,
    onPrevious: fn(),
    onNext: fn(),
    page: { users: [...USERS], nextCursor: USERS.at(-1)?.id ?? null },
  },
};

const VIEW_ONLY = {
  canInspect: false,
  canControl: false,
  controlDenial: {
    icon: KeyRoundIcon,
    title: 'Not available',
    dataSet: {
      testid: 'synthetic-population-control-denied',
      reason: 'not_granted',
    },
  },
};

/** A viewer who may neither inspect nor control: rows open nothing. */
export const ViewOnly: Story = { args: VIEW_ONLY };

/** A viewer presses "Pause every": told why they may not. */
export const ControlDenied: Story = {
  args: VIEW_ONLY,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('synthetic-population-pause-all'));
    await expect(
      await canvas.findByTestId('synthetic-population-control-denied')
    ).toBeVisible();
  },
};

/** Pausing every Synthetic User asks first. */
export const ConfirmPauseAll: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('synthetic-population-pause-all'));
    await expect(
      await canvas.findByText('Pause every Synthetic User?')
    ).toBeVisible();
    await expect(args.onCommandAll).not.toHaveBeenCalled();
  },
};

/** Long names, regions and many favorite games wrap inside their cells. */
export const LongContent: Story = {
  args: {
    page: {
      users: [
        userRow(9, 'the_grand_strategist_of_rainy_tuesday_evenings', {
          region: 'Saint Petersburg, Russian Federation',
          persona: {
            ...PERSONA,
            username: 'the_grand_strategist_of_rainy_tuesday_evenings',
            avatar: face('thumbs', 'a7c31e90d2b4'),
            homeRegion: 'Saint Petersburg, Russian Federation',
            favoriteGames: [
              'backgammon',
              'checkers',
              'dominoes',
              'go',
              'mancala',
              'reversi',
            ],
          },
        }),
        ...USERS,
      ],
      nextCursor: null,
    },
  },
};

/** A person without permission: the denial replaces the screen. */
export const Denied: Story = {
  args: {
    page: undefined,
    overview: undefined,
    denial: {
      icon: KeyRoundIcon,
      title: 'Not available',
      dataSet: { testid: 'synthetic-population-denied', reason: 'not_granted' },
    },
  },
};

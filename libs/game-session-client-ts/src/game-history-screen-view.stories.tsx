import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PEOPLE } from './game-frame-story.example';
import {
  type GameHistoryRow,
  GameHistoryScreenView,
} from './game-history-screen-view';

const RECORDS: readonly GameHistoryRow[] = [
  {
    id: 'game-3',
    players: [
      { person: PEOPLE.avery, plainName: 'avery', bot: false, local: false },
      {
        person: PEOPLE.jordan,
        plainName: 'jordan_plays',
        bot: false,
        local: false,
      },
    ],
    label: 'Red circle wins by four in a row.',
  },
  {
    id: 'game-2',
    players: [
      { person: PEOPLE.avery, plainName: 'avery', bot: false, local: false },
      { person: '', plainName: '', bot: true, local: false },
    ],
    label: 'Game drawn.',
  },
  {
    id: 'game-1',
    players: [
      { person: PEOPLE.avery, plainName: 'avery', bot: false, local: false },
      { person: '', plainName: '', bot: false, local: true },
    ],
    label: 'Yellow diamond wins by resignation.',
  },
];

const meta = {
  id: 'screens-games-frame-history',
  title: 'Screens/Games/Frame/History and stats',
  component: GameHistoryScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['records', 'denial', 'people', 'statistics'] },
  },
  args: {
    loading: false,
    statistics: { wins: 4, losses: 2, draws: 1 },
    records: RECORDS,
    onSelect: fn(),
  },
} satisfies Meta<typeof GameHistoryScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Finished games, newest first, under the person's wins, losses and draws. */
export const Populated: Story = {};

/** The first read has not finished and nothing is known yet. */
export const Loading: Story = {
  args: {
    loading: true,
    records: [],
    statistics: { wins: 0, losses: 0, draws: 0 },
  },
};

/** No finished games yet: the empty state says where they will appear. */
export const Empty: Story = {
  args: { records: [], statistics: { wins: 0, losses: 0, draws: 0 } },
};

/** A cancelled set-up game keeps its unfilled places as "No participant". */
export const CancelledSetup: Story = {
  args: {
    records: [
      {
        id: 'game-4',
        players: [
          {
            person: PEOPLE.avery,
            plainName: 'avery',
            bot: false,
            local: false,
          },
          { person: '', plainName: '', bot: false, local: false },
        ],
        label: 'Game cancelled.',
      },
    ],
  },
};

/** Long names stay on one row with their result under them. */
export const LongNames: Story = {
  args: {
    records: [
      {
        id: 'game-5',
        players: [
          {
            person: PEOPLE.morgan,
            plainName: 'morgan_who_plays_connect_four_every_single_day',
            bot: false,
            local: false,
          },
          {
            person: PEOPLE.robin,
            plainName: 'robin_the_unbeatable_column_strategist',
            bot: false,
            local: false,
          },
        ],
        label: 'Red circle and Yellow diamond win by the full board.',
      },
      ...RECORDS,
    ],
  },
};

/** Someone who may not see this space's games sees the way forward instead. */
export const Denied: Story = {
  args: {
    records: [],
    denial: {
      icon: KeyRoundIcon,
      title: 'Join this space to see its games',
      body: 'Games in a space are for the people in it.',
      action: { label: 'Join space', onPress: fn() },
      dataSet: { testid: 'game-history-denial', reason: 'not_granted' },
    },
  },
};

/** Choosing a game opens its replay. */
export const OpenRecord: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Game drawn.'));
    await expect(args.onSelect).toHaveBeenCalledWith('game-2');
  },
};

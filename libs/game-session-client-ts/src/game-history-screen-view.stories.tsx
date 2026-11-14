import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PEOPLE } from './game-frame-story.example';
import {
  type GameHistoryPlayer,
  type GameHistoryRow,
  GameHistoryScreenView,
} from './game-history-screen-view';

/** Storybook's clock starts at 1_700_000_000_000; games end before it. */
const NOW = 1_700_000_000_000;
const HOUR = 3_600_000;
const ago = (hours: number): string =>
  new Date(NOW - hours * HOUR).toISOString();

const JORDAN: GameHistoryPlayer = {
  person: PEOPLE.jordan,
  plainName: 'jordan_plays',
  bot: false,
  local: false,
};
const BOT: GameHistoryPlayer = {
  person: '',
  plainName: '',
  bot: true,
  local: false,
};

/** Avery's view: each row names who Avery played and leads with Avery's result. */
const RECORDS: readonly GameHistoryRow[] = [
  {
    id: 'game-4',
    players: [JORDAN],
    outcome: 'won',
    label: 'By four in a row',
    moves: 7,
    endedAt: ago(2),
  },
  {
    id: 'game-3',
    players: [BOT],
    outcome: 'draw',
    label: 'Drawn',
    moves: 42,
    endedAt: ago(26),
  },
  {
    id: 'game-2',
    players: [{ person: '', plainName: '', bot: false, local: true }],
    outcome: 'lost',
    label: 'By resignation',
    moves: 12,
    endedAt: ago(70),
  },
  {
    id: 'game-1',
    players: [
      { person: PEOPLE.morgan, plainName: 'morgan', bot: false, local: false },
      JORDAN,
    ],
    outcome: null,
    label: 'By four in a row',
    winners: [JORDAN],
    moves: 18,
    endedAt: ago(170),
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

/** No finished games yet: the empty state says what will appear and how to start. */
export const Empty: Story = {
  args: {
    records: [],
    statistics: { wins: 0, losses: 0, draws: 0 },
    onPlay: fn(),
  },
};

/** A cancelled set-up game keeps its unfilled places as "No participant". */
export const CancelledSetup: Story = {
  args: {
    records: [
      {
        id: 'game-4',
        players: [],
        outcome: 'cancelled',
        label: 'Cancelled before the first move',
        moves: 0,
        endedAt: ago(5),
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
        outcome: null,
        label: 'Drawn',
        moves: 42,
        endedAt: ago(1),
      },
      ...RECORDS,
    ],
  },
};

const OPPONENTS: readonly GameHistoryPlayer[] = [
  JORDAN,
  { person: PEOPLE.morgan, plainName: 'morgan', bot: false, local: false },
  { person: PEOPLE.robin, plainName: 'robin', bot: false, local: false },
  BOT,
];
const ENDINGS = [
  { outcome: 'won', label: 'By four in a row' },
  { outcome: 'lost', label: 'By four in a row' },
  { outcome: 'draw', label: 'Drawn' },
  { outcome: 'won', label: 'By resignation' },
  { outcome: 'lost', label: 'By time' },
] as const;

/** A season of play: two dozen finished games, newest first. */
const MANY_RECORDS: readonly GameHistoryRow[] = Array.from(
  { length: 24 },
  (_, index) => ({
    id: `game-many-${String(24 - index)}`,
    players: [OPPONENTS[index % OPPONENTS.length] ?? JORDAN],
    ...(ENDINGS[index % ENDINGS.length] ?? ENDINGS[0]),
    moves: 7 + ((index * 5) % 30),
    endedAt: ago(3 + index * 9),
  })
);

/** Many finished games: the list is long enough to scroll. */
export const Many: Story = {
  args: {
    records: MANY_RECORDS,
    statistics: { wins: 10, losses: 9, draws: 5 },
  },
};

/** One finished game. */
export const Single: Story = {
  args: {
    records: RECORDS.slice(0, 1),
    statistics: { wins: 1, losses: 0, draws: 0 },
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
    const rows = await canvas.findAllByTestId('game-history-record');
    await userEvent.click(rows[1]!);
    await expect(args.onSelect).toHaveBeenCalledWith('game-3');
  },
};

/** A long list filtered to the games lost. */
export const FilteredLost: Story = {
  args: {
    records: MANY_RECORDS,
    statistics: { wins: 10, losses: 9, draws: 5 },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole('radio', { name: 'Lost' }));
    await expect(canvas.queryAllByText('Won')).toHaveLength(1);
  },
};

import { ConnectFourStoryBoard } from '@libs/game-session-client-ts/connect-four-story-board.example';
import { ClockIcon, KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  MultiplayerScreenView,
  type MultiplayerScreenViewProps,
} from './multiplayer-screen-view';

const resolved = () => fn(() => Promise.resolve());

const SPEED_RATINGS = [
  { pool: 'bullet', rating: 1500, games: 0 },
  { pool: 'blitz', rating: 1623, games: 41 },
  { pool: 'rapid', rating: 1488, games: 12 },
  { pool: 'classical', rating: 1500, games: 0 },
  { pool: 'daily', rating: 1551, games: 3 },
] as const;

/** The view with Connect Four's board in its matched-game slot. */
function matched(args: MultiplayerScreenViewProps) {
  return (
    <MultiplayerScreenView
      {...args}
      board={<ConnectFourStoryBoard moves={[3, 3, 4]} interactive />}
    />
  );
}

const meta = {
  id: 'screens-games-matchmaking',
  title: 'Screens/Games/Matchmaking/Find an opponent',
  component: MultiplayerScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: {
      exclude: [
        'denial',
        'commandDenial',
        'next',
        'ratings',
        'board',
        'setupPanel',
        'gameActions',
        'moves',
      ],
    },
  },
  args: {
    title: 'Connect Four',
    stage: 'search',
    next: { kind: 'find', players: 2, timed: false },
    error: null,
    online: true,
    ratings: [{ pool: 'game', rating: 1512, games: 7 }],
    confirming: null,
    manyPlayers: false,
    onFind: resolved(),
    onStop: resolved(),
    onConfirm: resolved(),
    onCloseConfirm: fn(),
  },
} satisfies Meta<typeof MultiplayerScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Before a search: find an opponent for a game without clock choices. */
export const FindOpponent: Story = {};

/** A game with clock choices: pick a time control, then find an opponent at it. */
export const FindTimed: Story = {
  args: {
    title: 'Chess',
    next: { kind: 'find', players: 2, timed: true },
    ratings: SPEED_RATINGS,
  },
};

/** A bigger game: find the other players, at the same clock choice. */
export const FindPlayers: Story = {
  args: {
    title: 'Hearts',
    next: { kind: 'find', players: 4, timed: true },
  },
};

/** Searching: the time control, how long it has looked, and a way to stop. */
export const Searching: Story = {
  args: {
    next: {
      kind: 'searching',
      search: {
        players: 2,
        gameName: 'Chess',
        timeControl: '5+3',
        seconds: 42,
      },
    },
  },
};

/** Searching for three other players of a game with no clock choices. */
export const SearchingForPlayers: Story = {
  args: {
    title: 'Hearts',
    next: {
      kind: 'searching',
      search: { players: 4, gameName: 'Hearts', timeControl: null, seconds: 7 },
    },
  },
};

/** Matched: the game's board takes the stage and the ratings sit beside it. */
export const Matched: Story = {
  render: (args) => matched(args),
  args: { stage: 'game', next: { kind: 'none' } },
};

/** The game is over: the board stays and a new search can start. */
export const AfterTheGame: Story = {
  render: (args) => matched(args),
  args: { stage: 'game' },
};

/** Still reading the game and search the space's host holds. */
export const Loading: Story = {
  args: { stage: 'loading', next: { kind: 'none' } },
};

/** A watcher in a space whose host has no game. */
export const Unavailable: Story = {
  args: { stage: 'unavailable', next: { kind: 'none' } },
};

/** Searching while another game is unfinished: finish it first. */
export const FinishCurrentGameFirst: Story = {
  args: {
    commandDenial: {
      icon: ClockIcon,
      title: 'Finish your current game first',
      body: 'You can play one game at a time. Finish or leave it, then find another.',
      dataSet: {
        testid: 'multiplayer-command-denial',
        reason: 'limit_reached',
      },
    },
  },
};

/** A command was refused: the reason sits above with the search still on offer. */
export const CommandRefused: Story = {
  args: { error: 'Multiplayer game could not accept that command.' },
};

/** Offline: commands wait for the connection; an accepted game stays here. */
export const Offline: Story = {
  render: (args) => matched(args),
  args: { stage: 'game', next: { kind: 'none' }, online: false },
};

/** Resigning asks first; the opponent wins. */
export const ConfirmResign: Story = {
  render: (args) => matched(args),
  args: { stage: 'game', next: { kind: 'none' }, confirming: 'resign' },
};

/** Resigning a bigger game draws the round for everyone. */
export const ConfirmResignManyPlayers: Story = {
  render: (args) => matched(args),
  args: {
    stage: 'game',
    next: { kind: 'none' },
    confirming: 'resign',
    manyPlayers: true,
  },
};

/** Aborting before the first moves ends the game with no result. */
export const ConfirmAbort: Story = {
  render: (args) => matched(args),
  args: { stage: 'game', next: { kind: 'none' }, confirming: 'abort' },
};

/** Someone who may not watch this space's game sees the way forward. */
export const Denied: Story = {
  args: {
    denial: {
      icon: KeyRoundIcon,
      title: 'Sign in to find an opponent',
      body: 'Matched games are rated and need an account.',
      action: { label: 'Sign in', onPress: fn() },
      dataSet: {
        testid: 'multiplayer-access-denial',
        reason: 'requires_account',
      },
    },
  },
};

/** Choosing a time control, then finding an opponent at it. */
export const ChooseTimeControl: Story = {
  args: {
    title: 'Chess',
    next: { kind: 'find', players: 2, timed: true },
    ratings: SPEED_RATINGS,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('multiplayer-find'));
    await expect(args.onFind).toHaveBeenCalled();
  },
};

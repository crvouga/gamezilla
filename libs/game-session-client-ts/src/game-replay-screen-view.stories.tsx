import { createSignal } from 'solid-js';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ConnectFourStoryBoard } from './connect-four-story-board.example';
import { PEOPLE, WON_LINE, WON_MOVES } from './game-frame-story.example';
import { GameHistoryScreenView } from './game-history-screen-view';
import {
  type GameReplayMove,
  type GameReplayPlayer,
  GameReplayScreenView,
  type GameReplayScreenViewProps,
} from './game-replay-screen-view';

const RED = { color: 'disc-one', mark: '●' } as const;
const YELLOW = { color: 'disc-two', mark: '◆' } as const;

/** Avery (Red circle, first) beat Jordan (Yellow diamond). */
const PLAYERS: readonly GameReplayPlayer[] = [
  {
    person: PEOPLE.avery,
    plainName: 'avery',
    bot: false,
    local: false,
    sideLabel: 'Red circle',
    swatch: RED,
    winner: true,
    you: true,
  },
  {
    person: PEOPLE.jordan,
    plainName: 'jordan_plays',
    bot: false,
    local: false,
    sideLabel: 'Yellow diamond',
    swatch: YELLOW,
    winner: false,
    you: false,
  },
];

/** Each drop as Connect Four writes it (its column), by alternating seats. */
const MOVES: readonly GameReplayMove[] = WON_MOVES.map((column, index) => ({
  label: String(column + 1),
  ...(index % 2 === 0
    ? { sideLabel: 'Red circle', swatch: RED }
    : { sideLabel: 'Yellow diamond', swatch: YELLOW }),
}));

/** The replay with Connect Four's board at the move shown. */
function atPly(args: GameReplayScreenViewProps) {
  const moves = WON_MOVES.slice(0, args.ply);
  return (
    <GameReplayScreenView
      {...args}
      position={`fixture:${String(args.ply)}`}
      board={
        <ConnectFourStoryBoard
          moves={moves}
          winning={args.ply === WON_MOVES.length ? WON_LINE : undefined}
        />
      }
    />
  );
}

const meta = {
  id: 'screens-games-frame-replay',
  title: 'Screens/Games/Frame/Game replay',
  component: GameReplayScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['board', 'position', 'players', 'moves'] },
  },
  args: {
    players: PLAYERS,
    outcome: 'won',
    result: 'You won by four in a row.',
    endedAt: new Date(1_700_000_000_000 - 2 * 3_600_000).toISOString(),
    ply: WON_MOVES.length,
    moves: MOVES,
    moveHeading: 'Column',
    position: '',
    board: null,
    onSeek: fn(),
    onBack: fn(),
  },
  render: (args) => atPly(args),
} satisfies Meta<typeof GameReplayScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A replay opens on the final position; the steps forward are held back at the end. */
export const FinalPosition: Story = {};

/** Stepping back through the game: every step is open. */
export const MidGame: Story = { args: { ply: 3 } };

/** The starting position: the steps back are held back. */
export const Start: Story = { args: { ply: 0 } };

/** A game someone else played: both players named, the winner said in full. */
export const Watched: Story = {
  args: {
    outcome: null,
    result: 'Red circle wins by four in a row.',
    players: PLAYERS.map((player) => ({ ...player, you: false })),
  },
};

/** A game cancelled before its first move: there is nothing to step through. */
export const NoMoves: Story = {
  args: {
    ply: 0,
    moves: [],
    outcome: 'cancelled',
    result: 'Game cancelled.',
    players: PLAYERS.map((player) => ({ ...player, winner: false })),
  },
};

/** Pressing a move in the list shows the board after it. */
export const JumpToMove: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('game-history-review-move-3')
    );
    await expect(args.onSeek).toHaveBeenCalledWith(3);
  },
};

/** The left arrow key steps back one move. */
export const ArrowKeyStepsBack: Story = {
  play: async ({ args }) => {
    await userEvent.keyboard('{ArrowLeft}');
    await expect(args.onSeek).toHaveBeenCalledWith(WON_MOVES.length - 1);
  },
};

/** "All games" goes back to the list of finished games. */
export const BackToAllGames: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'All games' })
    );
    await expect(args.onBack).toHaveBeenCalled();
  },
};

/**
 * The whole journey with the container's state: the list, a game opened
 * from it, any move shown, and back to the list. Automated walks drive it.
 */
export const Journey: Story = {
  render: (args) => {
    const [open, setOpen] = createSignal(false);
    const [ply, setPly] = createSignal(WON_MOVES.length);
    return (
      <>
        {open() ? (
          atPly({
            ...args,
            ply: ply(),
            onSeek: setPly,
            onBack: () => setOpen(false),
          })
        ) : (
          <GameHistoryScreenView
            loading={false}
            statistics={{ wins: 1, losses: 0, draws: 0 }}
            records={[
              {
                id: 'game-1',
                players: [PLAYERS[1]!],
                outcome: 'won',
                label: 'By four in a row',
                moves: WON_MOVES.length,
                endedAt: args.endedAt,
              },
            ]}
            onSelect={() => {
              setPly(WON_MOVES.length);
              setOpen(true);
            }}
          />
        )}
      </>
    );
  },
};

/** Twenty drops across the board, no line yet: a long game's middle. */
const LONG_COLUMNS = [
  3, 2, 4, 1, 5, 0, 6, 3, 2, 4, 1, 5, 0, 6, 3, 2, 4, 1, 5, 0,
];
const LONG_MOVES: readonly GameReplayMove[] = LONG_COLUMNS.map(
  (column, index) => ({
    label: String(column + 1),
    ...(index % 2 === 0
      ? { sideLabel: 'Red circle', swatch: RED }
      : { sideLabel: 'Yellow diamond', swatch: YELLOW }),
  })
);

/** A game longer than a phone's page of moves: the page holding move 11, with page controls. */
export const LongGame: Story = {
  args: {
    ply: 11,
    moves: LONG_MOVES,
    outcome: 'draw',
    result: 'Game drawn.',
    players: PLAYERS.map((player) => ({ ...player, winner: false })),
  },
  render: (args) => (
    <GameReplayScreenView
      {...args}
      position={`fixture:long:${String(args.ply)}`}
      board={<ConnectFourStoryBoard moves={LONG_COLUMNS.slice(0, args.ply)} />}
    />
  ),
};

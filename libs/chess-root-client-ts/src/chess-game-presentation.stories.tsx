import {
  BOARD_CONTROLS_EXCLUDE,
  boardArgs,
  type GameTableStory,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import { TWO_PLAYER_SIDES } from '@pkgs/turn-game-shared-ts/game-rules';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { withChessBoardContext } from './chess-board-story.example';
import { ChessGameBoard, chessPresentation } from './chess-game-presentation';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
/** The Italian Game after 3...Bc5: White to move. */
const ITALIAN =
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
const ITALIAN_MOVES = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5'];
/** A quiet Giuoco Piano after 7...a6: both castled, White to move. */
const GIUOCO =
  'r1bq1rk1/1pp2ppp/p1np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQR1K1 w - - 0 8';
const GIUOCO_MOVES = [
  ...ITALIAN_MOVES,
  'c3',
  'Nf6',
  'd3',
  'd6',
  'O-O',
  'O-O',
  'Re1',
  'a6',
];
/** After 3.Bb5+: Black's king is in check. */
const CHECK = 'rnbqkbnr/ppp2ppp/8/1B1pp3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 3';
/** The fool's mate: White is checkmated on move two. */
const FOOLS_MATE =
  'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
const FOOLS_MATE_MOVES = ['f3', 'e5', 'g4', 'Qh4#'];
/** Black to move has no legal move and is not in check. */
const STALEMATE = '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1';
/** Two bare kings: neither side can checkmate. */
const BARE_KINGS = '8/8/4k3/8/8/3K4/8/8 w - - 0 60';

const meta = {
  id: 'screens-games-chess-board',
  title: 'Screens/Games/Chess/Board',
  component: ChessGameBoard,
  tags: ['autodocs'],
  decorators: [withChessBoardContext],
  render: (args, context) =>
    renderGameTable(chessPresentation, TWO_PLAYER_SIDES, args, context),
  parameters: {
    appRouter: true,
    controls: { exclude: [...BOARD_CONTROLS_EXCLUDE] },
    table: { title: 'Chess', turn: 'white' } satisfies GameTableStory,
  },
  args: boardArgs(START, { interactive: true }),
} satisfies Meta<typeof ChessGameBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A new game: White moves first, legal moves highlighted on pick-up. */
export const Opening: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pawn = canvas.getByRole('button', { name: 'e2, White pawn' });
    pawn.focus();
    await userEvent.keyboard('{Enter}');
    await expect(pawn).toHaveAttribute('aria-pressed', 'true');
    await expect(
      canvas.getByRole('button', {
        name: 'e4, empty, Legal destination',
      })
    ).toBeVisible();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}{Enter}');
    await expect(
      canvas.getByRole('button', { name: 'e4, White pawn' })
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'e2, empty' })
    ).toBeVisible();
  },
};

/**
 * Mid-game on White's turn, seven moves each in the record, the last move
 * highlighted: the record a real game shows, not three lonely rows.
 */
export const YourTurn: Story = {
  args: { position: GIUOCO, lastAction: 'a7a6' },
  parameters: { table: { turn: 'white', moves: GIUOCO_MOVES } },
};

/** Three moves in, on White's turn: a short record. */
export const EarlyGame: Story = {
  args: { position: ITALIAN, lastAction: 'f8c5' },
  parameters: { table: { turn: 'white', moves: ITALIAN_MOVES } },
};

/** Black's side, board turned, while White decides. */
export const WaitingForOpponent: Story = {
  args: {
    position: ITALIAN,
    lastAction: 'f8c5',
    orientation: 'black',
    interactive: false,
  },
  parameters: { table: { turn: 'white', moves: ITALIAN_MOVES } },
};

/** Black to move out of check from the bishop. */
export const InCheck: Story = {
  args: { position: CHECK, lastAction: 'f1b5', orientation: 'black' },
  parameters: { table: { turn: 'black' } satisfies GameTableStory },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Black pieces nearest you/)).toBeVisible();
    await expect(canvas.getByText(/Black is in check/)).toBeVisible();
    await expect(canvas.getByText(/Escape to cancel/)).toBeVisible();
  },
};

/** A watcher follows from White's side; nothing can be moved. */
export const Watching: Story = {
  args: { position: ITALIAN, lastAction: 'f8c5', interactive: false },
  parameters: {
    table: { viewer: null, turn: 'white', moves: ITALIAN_MOVES },
  },
};

/** Black checkmated White: White's side, beaten. */
export const Checkmated: Story = {
  args: { position: FOOLS_MATE, lastAction: 'd8h4', interactive: false },
  parameters: {
    table: {
      moves: FOOLS_MATE_MOVES,
      ending: { winner: 'black', reason: 'checkmate' },
    } satisfies GameTableStory,
  },
};

/** Black has no legal move and is not in check: a draw. */
export const Stalemate: Story = {
  args: { position: STALEMATE, interactive: false },
  parameters: {
    table: {
      ending: { winner: 'draw', reason: 'stalemate' },
    } satisfies GameTableStory,
  },
};

/** Only the kings are left: drawn, since neither side can checkmate. */
export const InsufficientMaterial: Story = {
  args: { position: BARE_KINGS, interactive: false },
  parameters: {
    table: {
      ending: { winner: 'draw', reason: 'insufficient material' },
    } satisfies GameTableStory,
  },
};

/** Choose an underpromotion through the real board, then observe the new piece. */
export const PromotionChoice: Story = {
  args: { position: '7k/P7/8/8/8/8/8/7K w - - 0 1' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    canvas.getByRole('button', { name: 'a7, White pawn' }).focus();
    await userEvent.keyboard('{Enter}{ArrowUp}{Enter}');
    await expect(canvas.getByRole('button', { name: 'Queen' })).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Knight' }));
    await expect(
      canvas.getByRole('button', { name: 'a8, White knight' })
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'a7, empty' })
    ).toBeVisible();
  },
};

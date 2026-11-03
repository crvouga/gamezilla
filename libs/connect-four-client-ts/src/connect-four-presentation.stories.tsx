import {
  encodeConnectFour,
  replayConnectFour,
} from '@libs/connect-four-shared-ts/connect-four';
import { TWO_PLAYER_SIDES } from '@pkgs/turn-game-shared-ts/game-rules';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  ConnectFourGameBoard,
  connectFourPresentation,
} from './connect-four-presentation';
import {
  BOARD_CONTROLS_EXCLUDE,
  boardArgs,
  type GameTableStory,
  renderGameTable,
} from './game-table.example';

/** The position after `columns` dropped in turn, Red first (0 is column 1). */
function after(columns: string): string {
  return encodeConnectFour(replayConnectFour(columns.split('').map(Number)));
}

const MID_GAME = '3324452';

const meta = {
  id: 'screens-games-connect-four-board',
  title: 'Screens/Games/Connect Four/Board',
  component: ConnectFourGameBoard,
  tags: ['autodocs'],
  render: (args, context) =>
    renderGameTable(connectFourPresentation, TWO_PLAYER_SIDES, args, context),
  parameters: {
    appRouter: true,
    controls: { exclude: [...BOARD_CONTROLS_EXCLUDE] },
    table: { turn: 'white' } satisfies GameTableStory,
  },
  args: boardArgs(after(''), { interactive: true }),
} satisfies Meta<typeof ConnectFourGameBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A new game: Red moves first, so the person playing Red can drop anywhere. */
export const Opening: Story = {};

/** Mid-game on the person's turn: every open column offers a drop. */
export const YourTurn: Story = { args: { position: after(MID_GAME) } };

/** Mid-game while Yellow decides: the board is shown but takes no drops. */
export const WaitingForOpponent: Story = {
  args: { position: after(`${MID_GAME}1`), interactive: false },
  parameters: { table: { turn: 'black' } satisfies GameTableStory },
};

/** Someone watching: both seats are the others', and nothing can be dropped. */
export const Watching: Story = {
  args: { position: after(MID_GAME), interactive: false },
  parameters: { table: { viewer: null, turn: 'white' } },
};

/** Red's fourth disc in a column wins: the four are marked, and Red is told they won. */
export const Won: Story = {
  args: { position: after('0101010'), interactive: false },
  parameters: {
    table: {
      ending: { winner: 'white', reason: 'four in a row' },
    } satisfies GameTableStory,
  },
};

/** Yellow connects four across the bottom: Red sees who won and how. */
export const Lost: Story = {
  args: { position: after('60615253'), interactive: false },
  parameters: {
    table: {
      ending: { winner: 'black', reason: 'four in a row' },
    } satisfies GameTableStory,
  },
};

/** Forty-two discs and no four: the full board is a draw for both. */
export const FullBoardDraw: Story = {
  args: {
    position: after('000000111111222222433333344444555555666666'),
    interactive: false,
  },
  parameters: {
    table: {
      ending: { winner: 'draw', reason: 'full board' },
    } satisfies GameTableStory,
  },
};

/** Choosing a column sends that column as the move (column 4 is action 3). */
export const DropADisc: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-column-4')
    );
    await expect(args.onAction).toHaveBeenCalledWith('3');
  },
};

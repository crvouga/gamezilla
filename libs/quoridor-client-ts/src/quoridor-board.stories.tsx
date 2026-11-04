import {
  BOARD_CONTROLS_EXCLUDE,
  boardArgs,
  type GameTableStory,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import {
  encodeQuoridor,
  replayQuoridor,
} from '@libs/quoridor-shared-ts/quoridor';
import { TWO_PLAYER_SIDES } from '@pkgs/turn-game-shared-ts/game-rules';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { QuoridorBoard } from './quoridor-board';
import { quoridorGameClient } from './quoridor-game-client';

/** The classic position after `actions`, South first. */
function classic(actions: string): string {
  return encodeQuoridor(
    replayQuoridor('classic', actions === '' ? [] : actions.split(' '))
  );
}

/** Both pawns advanced and four walls placed; South to move. */
const MID_GAME = 'e2 e8 e3 e7 d4h e6 f6v d7h';
/** South walks up the e file while North steps aside: South reaches row 9. */
const SOUTH_WINS = 'e2 d9 e3 c9 e4 b9 e5 a9 e6 a8 e7 a7 e8 a6 e9';

const meta = {
  id: 'screens-games-quoridor-classic',
  title: 'Screens/Games/Quoridor/Classic',
  component: QuoridorBoard,
  tags: ['autodocs'],
  render: (args, context) =>
    renderGameTable(
      quoridorGameClient.presentation,
      TWO_PLAYER_SIDES,
      args,
      context
    ),
  parameters: {
    appRouter: true,
    controls: { exclude: [...BOARD_CONTROLS_EXCLUDE] },
    table: { turn: 'white' } satisfies GameTableStory,
  },
  args: boardArgs(classic(''), { interactive: true }),
} satisfies Meta<typeof QuoridorBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The start: South moves first, ten walls each, the move tool chosen. */
export const Opening: Story = {};

/** Mid-game on South's turn: walls on the board, fewer left to place. */
export const YourTurn: Story = { args: { position: classic(MID_GAME) } };

/** North is deciding: the board is read-only and the tools are off. */
export const WaitingForOpponent: Story = {
  args: { position: classic(`${MID_GAME} c3v`), interactive: false },
  parameters: { table: { turn: 'black' } satisfies GameTableStory },
};

/** A watcher follows the game from outside it. */
export const Watching: Story = {
  args: { position: classic(MID_GAME), interactive: false },
  parameters: { table: { viewer: null, turn: 'white' } },
};

/** South reached the opposite home row and won. */
export const Won: Story = {
  args: { position: classic(SOUTH_WINS), interactive: false },
  parameters: {
    table: {
      ending: { winner: 'white', reason: 'opposite row reached' },
    } satisfies GameTableStory,
  },
};

/** North's side of the same game: South got there first. */
export const Lost: Story = {
  args: {
    position: classic(SOUTH_WINS),
    interactive: false,
    orientation: 'black',
  },
  parameters: {
    table: {
      ending: { winner: 'white', reason: 'opposite row reached' },
    } satisfies GameTableStory,
  },
};

/** Choosing the horizontal wall tool, then an anchor, places that wall. */
export const PlaceAWall: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-mode-h')
    );
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-action-e5h')
    );
    await expect(args.onAction).toHaveBeenCalledWith('e5h');
  },
};

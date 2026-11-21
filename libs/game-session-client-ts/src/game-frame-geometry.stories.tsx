import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ConnectFourStoryBoard } from './connect-four-story-board.example';
import { FrameChrome } from './frame-chrome.example';
import {
  expectBoardFirst,
  expectTerminalVisible,
} from './game-frame-geometry.example';
import { GameFrameScreenView } from './game-frame-screen-view';
import { FourSeats, YourTurn } from './game-frame-screen-view.play.stories';
import { Draw } from './game-frame-screen-view.result.stories';
import {
  FRAME_OVER,
  FRAME_PLAYING,
  frameArgs,
  MID_GAME_MOVES,
  STORY_PRESENT,
  WON_LINE,
  WON_MOVES,
} from './game-frame-story.example';

const meta = {
  id: 'screens-games-frame-geometry',
  title: 'Screens/Games/Frame/Board priority',
  component: GameFrameScreenView,
  parameters: {
    appRouter: true,
    viewport: {
      options: {
        boardDesktop: {
          name: 'Board desktop',
          styles: { width: '1440px', height: '844px' },
        },
      },
    },
  },
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: frameArgs(),
  render: (args) => (
    <FrameChrome people={STORY_PRESENT}>
      <GameFrameScreenView
        {...args}
        board={
          <ConnectFourStoryBoard
            moves={args.phase === 'completed' ? WON_MOVES : MID_GAME_MOVES}
            winning={args.phase === 'completed' ? WON_LINE : undefined}
          />
        }
      />
    </FrameChrome>
  ),
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

// regression: shared-board-metadata-height
/** A two-player game leaves the initial viewport to the board. */
export const TwoPlayers: Story = {
  args: { ...FRAME_PLAYING, ...YourTurn.args },
  play: async ({ canvasElement }) => {
    await expectBoardFirst(canvasElement);
  },
};

// regression: shared-board-metadata-height
/** Four named players share a compact band without losing seat state. */
export const FourPlayers: Story = {
  args: { ...FRAME_PLAYING, ...FourSeats.args },
  play: async ({ canvasElement }) => {
    const { canvas, board, view } = await expectBoardFirst(canvasElement);
    const seats = ['white', 'black', 'red', 'blue'].map((side) =>
      canvas.getByTestId(`custom-game-${side}-person`)
    );
    for (const player of seats)
      await expect(player.getBoundingClientRect().height).toBeLessThan(112);
    await expect(
      canvas.getByTestId('custom-game-white-person')
    ).toHaveAttribute('data-status', 'turn');
    await expect(board.getBoundingClientRect().top).toBeLessThan(
      view.innerWidth < 880 ? 320 : 260
    );
  },
};

// regression: shared-board-terminal-buried
/** The outcome and real rematch action precede the final board. */
export const Win: Story = {
  args: { ...FRAME_OVER },
  play: async ({ args, canvasElement }) => {
    await expectTerminalVisible(canvasElement);
    await userEvent.click(
      within(canvasElement).getByTestId('custom-game-rematch')
    );
    await expect(args.onChoose).toHaveBeenCalledWith({ operation: 'rematch' });
  },
};

// regression: shared-board-terminal-buried
// regression: shared-drawn-geometry-winning-position
/** A drawn result retains its next actions, with no winning line drawn. */
export const Drawn: Story = {
  ...Draw,
  args: { ...FRAME_OVER, ...Draw.args },
  play: async ({ canvasElement }) => {
    await expectTerminalVisible(canvasElement);
    const board = within(canvasElement).getByTestId('custom-game-board');
    await expect(board).toHaveAttribute('data-won', 'false');
    await expect(board.querySelectorAll('[data-winning="true"]')).toHaveLength(
      0
    );
  },
};

/** The same content contracts at 1440 × 844 through native Viewport. */
const desktop = { viewport: { value: 'boardDesktop', isRotated: false } };
/** Two-player board priority on the wide host. */
export const TwoPlayersDesktop: Story = { ...TwoPlayers, globals: desktop };
/** Four-player band and board priority on the wide host. */
export const FourPlayersDesktop: Story = { ...FourPlayers, globals: desktop };
/** Completed-game next actions on the wide host. */
export const WinDesktop: Story = { ...Win, globals: desktop };
/** Drawn-game next actions on the wide host. */
export const DrawnDesktop: Story = { ...Drawn, globals: desktop };

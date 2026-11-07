import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ConnectFourStoryBoard } from './connect-four-story-board.example';
import {
  expectBoardFirst,
  expectFourSeatRail,
  expectTerminalVisible,
} from './game-frame-geometry.example';
import { GameFrameScreenView } from './game-frame-screen-view';
import {
  Draw,
  FourSeats,
  YourTurn,
  YouWin,
} from './game-frame-screen-view.stories';
import {
  frameArgs,
  MID_GAME_MOVES,
  person,
  playSeat,
  seat,
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
    <GameFrameScreenView
      {...args}
      board={
        <ConnectFourStoryBoard
          moves={args.phase === 'completed' ? WON_MOVES : MID_GAME_MOVES}
          winning={args.phase === 'completed' ? WON_LINE : undefined}
        />
      }
    />
  ),
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

// regression: shared-board-metadata-height
/** A two-player game leaves the initial viewport to the board. */
export const TwoPlayers: Story = {
  args: { ...YourTurn.args },
  play: async ({ canvasElement }) => {
    await expectBoardFirst(canvasElement);
  },
};

// regression: shared-board-metadata-height
/** Four named players share a compact band without losing seat state. */
export const FourPlayers: Story = {
  args: { ...FourSeats.args },
  play: async ({ canvasElement }) => {
    const { canvas, board, view } = await expectBoardFirst(canvasElement);
    const seats = ['white', 'black', 'red', 'blue'].map((side) =>
      canvas.getByTestId(`custom-game-${side}`)
    );
    for (const player of seats)
      await expect(player.getBoundingClientRect().height).toBeLessThan(112);
    if (view.innerWidth < 880) await expectFourSeatRail(seats);
    await expect(canvas.getByTestId('custom-game-white')).toHaveAttribute(
      'aria-current',
      'step'
    );
    await expect(board.getBoundingClientRect().top).toBeLessThan(320);
  },
};

// regression: shared-board-terminal-buried
/** The outcome and real rematch action precede the final board. */
export const Win: Story = {
  args: { ...YouWin.args },
  play: async ({ args, canvasElement }) => {
    await expectTerminalVisible(canvasElement);
    await userEvent.click(
      within(canvasElement).getByTestId('custom-game-rematch')
    );
    await expect(args.onChoose).toHaveBeenCalledWith({ operation: 'rematch' });
  },
};

// regression: shared-board-terminal-buried
/** A drawn result retains its next actions and final record label. */
export const Drawn: Story = {
  args: { ...Draw.args },
  play: async ({ canvasElement }) => {
    await expectTerminalVisible(canvasElement);
  },
};

// regression: shared-board-long-name-rail
/** Long identities stay on one line with the full name available. */
export const LongNameRail: Story = {
  args: {
    ...YourTurn.args,
    record: {
      earlier: [],
      selection: 'live',
      turns: false,
      moves: [],
      movers: [],
      perTurn: 2,
      displayedPly: 0,
      error: '',
      history: true,
    },
    table: {
      shape: 'strip',
      near: playSeat(
        seat(
          'white',
          person('avery'),
          'avery_the_extraordinarily_patient_strategist'
        ),
        { deciding: true }
      ),
      others: [
        playSeat(
          seat(
            'black',
            person('jordan'),
            'jordan_plays_every_single_evening_online'
          )
        ),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const { canvas, view } = await expectBoardFirst(canvasElement);
    for (const side of ['white', 'black']) {
      const name = canvas.getByTestId(`custom-game-${side}-person`);
      const identity = name.querySelector('[title]');
      if (!identity) throw new Error('Full identity must remain available');
      await expect(identity).toHaveAttribute('title', identity.textContent);
      await expect(identity.getBoundingClientRect().height).toBeLessThan(32);
      await expect(name.getBoundingClientRect().right).toBeLessThanOrEqual(
        view.innerWidth
      );
    }
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
/** Complete long names in the wide identity rail. */
export const LongNameRailDesktop: Story = { ...LongNameRail, globals: desktop };

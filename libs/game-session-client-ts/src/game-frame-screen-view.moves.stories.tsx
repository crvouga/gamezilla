import { createSignal } from 'solid-js';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ConnectFourStoryBoard } from './connect-four-story-board.example';
import { FrameStory, onBoard } from './game-frame-board.example';
import { GameFrameScreenView } from './game-frame-screen-view';
import {
  FRAME_CONTROLS_EXCLUDE,
  FRAME_OVER,
  frameArgs,
  MID_GAME_MOVES,
  MID_GAME_RECORD,
  FRAME_PLAYING as PLAYING,
  record,
  WON_MOVES,
  WON_RECORD,
} from './game-frame-story.example';

const meta = {
  id: 'screens-games-custom-moves',
  title: 'Screens/Games/Custom game/Moves',
  component: GameFrameScreenView,
  tags: ['autodocs', 'viewport-native-height'],
  parameters: {
    appRouter: true,
    controls: { exclude: FRAME_CONTROLS_EXCLUDE },
  },
  args: {
    ...frameArgs(),
    ...PLAYING,
    place: { screen: 'moves' },
    record: { ...record(MID_GAME_RECORD), displayedPly: 3 },
  },
  render: (args) => onBoard(MID_GAME_MOVES.slice(0, 3))(args),
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An earlier move of the game being played: the board shows that position, the line says which, and the four steps sit under it. */
export const EarlierMove: Story = {};

/** The starting position: stepping back is held, and the line says where the board stands. */
export const StartingPosition: Story = {
  args: { record: { ...record(MID_GAME_RECORD), displayedPly: 0 } },
  render: (args) => onBoard([])(args),
};

/** The latest move: stepping forward is held; Back to the game is the one filled command. */
export const LatestMove: Story = {
  args: { record: record(MID_GAME_RECORD) },
  render: (args) => onBoard(MID_GAME_MOVES)(args),
};

/** A move that was not played is refused in words, with the field still there to correct. */
export const MoveNotPlayed: Story = {
  args: {
    record: {
      ...record(MID_GAME_RECORD),
      displayedPly: 3,
      error: 'Choose a position from the moves actually played.',
    },
  },
};

/** An earlier game of this space, chosen from the list of games. */
export const EarlierGame: Story = {
  args: {
    record: {
      ...record(MID_GAME_RECORD),
      earlier: ['game-2', 'game-1'],
      selection: 'game-1',
      displayedPly: 3,
    },
  },
};

/** A long game lists only its latest moves; earlier ones are reached by number. */
export const LongRecord: Story = {
  args: {
    record: {
      ...record(
        Array.from({ length: 52 }, (_, index) => `m${String(index + 1)}`)
      ),
      displayedPly: 40,
    },
  },
};

/** A finished game's moves: the way back leads to the result. */
export const FinishedGame: Story = {
  args: {
    ...FRAME_OVER,
    place: { screen: 'moves' },
    record: { ...record(WON_RECORD), displayedPly: 4 },
  },
  render: (args) => onBoard(WON_MOVES.slice(0, 4))(args),
};

/** Stepping through the moves moves the board, and the last step returns to the latest move. */
export const StepThrough: Story = {
  render: (args) => {
    const [ply, setPly] = createSignal(3);
    return (
      <FrameStory
        {...args}
        record={{ ...record(MID_GAME_RECORD), displayedPly: ply() }}
        onSeek={(next) => {
          args.onSeek(next);
          setPly(next);
        }}
        onReturnLive={() => {
          args.onReturnLive();
          setPly(MID_GAME_RECORD.length);
        }}
        board={
          <ConnectFourStoryBoard
            moves={MID_GAME_MOVES.slice(0, ply())}
            interactive={false}
          />
        }
      />
    );
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-review-forward')
    );
    await expect(args.onSeek).toHaveBeenLastCalledWith(4);
    await userEvent.click(
      await canvas.findByTestId('custom-game-review-first')
    );
    await expect(args.onSeek).toHaveBeenLastCalledWith(0);
    await userEvent.click(await canvas.findByTestId('custom-game-review-live'));
    await expect(args.onReturnLive).toHaveBeenCalled();
  },
};

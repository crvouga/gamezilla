import {
  PUZZLE_PLAY_STORY_ARGS,
  PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE,
  type PuzzlePlayStoryArgs,
  renderPuzzlePlayScene,
  STORY_LINE,
  withScreenFrame,
} from '@libs/game-puzzle-client-ts/puzzle-screen-story.example';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ChessPuzzleBoard } from './chess-puzzle-board';
import {
  StoryChessPuzzleBoard,
  withChessPuzzleBoardContext,
} from './chess-puzzle-story.example';

/**
 * The feed's `play` place in each of its states, drawn with the board its
 * puzzle feed plays on (chess's), so a state's board looks the way it will
 * in the app and the same from one state to the next.
 */
const meta = {
  id: 'screens-puzzles-play',
  title: 'Screens/Puzzles/Play/Play',
  component: ChessPuzzleBoard,
  tags: ['autodocs'],
  decorators: [withScreenFrame, withChessPuzzleBoardContext],
  render: (args, context) =>
    renderPuzzlePlayScene(args, context, StoryChessPuzzleBoard),
  parameters: {
    appRouter: true,
    controls: { exclude: [...PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE] },
  },
  args: { ...PUZZLE_PLAY_STORY_ARGS, boardSizing: 'width' },
} satisfies Meta<PuzzlePlayStoryArgs>;
export default meta;
// The render owns screen-fixture args; the production board owns this story slice.
type Story = StoryObj<Omit<typeof meta, 'component'>>;

/** The solver's turn after the setup move: find the best move for White. */
export const Solving: Story = {};

/** A correct move landed and the opponent replied; the line continues. */
export const CorrectMove: Story = {
  args: {
    coach: {
      message:
        'Yes! The knight takes, and Black grabbed the queen. Keep going.',
      contextKey: 'after-bxd1',
    },
    elapsedMs: 27_000,
    correct: true,
  },
  parameters: {
    puzzleScene: { fen: STORY_LINE.afterBxd1, plies: 3, lastAction: 'g4d1' },
  },
};

/** A wrong move: it is crossed on the board and Retry is offered. */
export const WrongMove: Story = {
  args: {
    statusKind: 'failed',
    status: 'wrong',
    coach: {
      message: 'Not that one. The knight jump leaves the bishop on g4 alive.',
      contextKey: 'wrong',
    },
  },
  parameters: {
    puzzleScene: {
      fen: STORY_LINE.wrong,
      plies: 1,
      lastAction: 'c3d5',
      marks: { wrong: 'd5', hint: null, solution: null },
    },
  },
};

/** The first hint: the piece to move is marked; the solution is a step away. */
export const Hint: Story = {
  args: {
    hintStage: 'highlight',
    coach: {
      message: 'Look at the knight on f3. What can it take?',
      contextKey: 'hint',
    },
  },
  parameters: {
    puzzleScene: {
      fen: STORY_LINE.start,
      plies: 1,
      lastAction: 'g7g6',
      marks: { wrong: null, hint: 'f3', solution: null },
    },
  },
};

/** Rated puzzles are limited: the settings row says how many are left today. */
export const RatedAllowance: Story = {
  args: { allowanceLabel: '2 rated puzzles remaining today' },
};

/** A repeat of a puzzle already rated: the status line says it is unrated. */
export const UnratedRepeat: Story = { args: { ratingChange: 'unrated' } };

/** The board is on an earlier move: the one thing to do is to return. */
export const EarlierMove: Story = {
  args: { canGoForward: true, correct: true },
  parameters: {
    puzzleScene: {
      fen: STORY_LINE.start,
      plies: 3,
      selected: 1,
      lastAction: 'g7g6',
    },
  },
};

/** Watching the host solve: the board, the status line and the allowance only. */
export const Spectating: Story = {
  args: {
    spectator: true,
    allowanceLabel: '3 rated puzzles remaining today',
  },
};

/** A long coach line wraps to two lines without moving the board. */
export const LongCoachLine: Story = {
  args: {
    coach: {
      message:
        'The bishop on g4 pins your knight to the queen, but pins can be broken when the reward is bigger than what you give up — look for the checkmate pattern.',
    },
  },
};

/** The action bar's Hint asks for the first hint. */
export const AskForHint: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('chess-puzzle-action-hint')
    );
    await expect(args.onHint).toHaveBeenCalled();
  },
};

/** "Look back" opens the line, where the moves are stepped through. */
export const LookBack: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('chess-puzzle-line-open'));
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'line' });
    await expect(
      await canvas.findByTestId('chess-puzzle-move-nav-back')
    ).toBeVisible();
    await expect(canvas.queryByTestId('chess-puzzle-action-hint')).toBeNull();
  },
};

/** The settings row opens the puzzle settings, and Done returns to the board. */
export const OpenSettings: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('chess-puzzle-feed-summary')
    );
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'feed' });
    await userEvent.click(await canvas.findByTestId('chess-puzzle-feed-done'));
    await expect(
      await canvas.findByTestId('chess-puzzle-action-hint')
    ).toBeVisible();
  },
};

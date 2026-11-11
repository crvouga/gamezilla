import {
  PUZZLE_PLAY_STORY_ARGS,
  PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE,
  type PuzzlePlayStoryArgs,
  renderPuzzlePlayScene,
  STORY_LINE,
  STORY_RESULT,
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
 * The feed's `line` place: the moves played, stepped through on the board
 * the puzzle feed plays on (chess's).
 */
const meta = {
  id: 'screens-puzzles-play-line',
  title: 'Screens/Puzzles/Play/Line',
  component: ChessPuzzleBoard,
  tags: ['autodocs'],
  decorators: [withScreenFrame, withChessPuzzleBoardContext],
  render: (args, context) =>
    renderPuzzlePlayScene(args, context, StoryChessPuzzleBoard),
  parameters: {
    appRouter: true,
    controls: { exclude: [...PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE] },
    puzzleScene: {
      fen: STORY_LINE.afterNxe5,
      plies: 3,
      selected: 2,
      lastAction: 'f3e5',
    },
  },
  args: {
    ...PUZZLE_PLAY_STORY_ARGS,
    boardSizing: 'width',
    place: { screen: 'line' },
    canGoForward: true,
    correct: true,
    coach: {
      message: 'Yes! The knight takes, and Black grabbed the queen.',
      contextKey: 'after-bxd1',
    },
  },
} satisfies Meta<PuzzlePlayStoryArgs>;
export default meta;
// The render owns screen-fixture args; the production board owns this story slice.
type Story = StoryObj<Omit<typeof meta, 'component'>>;

/** Looking back while solving: an earlier move, and the way back to the puzzle. */
export const WhileSolving: Story = {};

/** A solved puzzle's whole line, on its last move: the next puzzle or a retry. */
export const Solved: Story = {
  args: {
    stage: 'finished',
    statusKind: 'solved',
    status: 'solved',
    canGoForward: false,
    correct: false,
    elapsedMs: 41_000,
    coach: { message: "Checkmate! That's Legal's mate." },
    ratingChange: 16,
    result: STORY_RESULT,
  },
  parameters: {
    puzzleScene: { fen: STORY_LINE.mate, plies: 6, lastAction: 'c3d5' },
  },
};

/** The solution shown, stepped back to the solver's first decision. */
export const SolutionShown: Story = {
  args: {
    ...Solved.args,
    statusKind: 'failed',
    status: 'revealed',
    hintStage: 'solution',
    canGoForward: true,
    coach: { message: 'The knight had to take on e5 first.' },
    ratingChange: -9,
  },
  parameters: {
    puzzleScene: {
      fen: STORY_LINE.start,
      plies: 6,
      selected: 1,
      lastAction: 'g7g6',
    },
  },
};

/** "Back to the puzzle" leaves the line for the board being solved. */
export const BackToThePuzzle: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('chess-puzzle-line-close'));
    await expect(args.onBack).toHaveBeenCalled();
    await expect(
      await canvas.findByTestId('chess-puzzle-action-hint')
    ).toBeVisible();
  },
};

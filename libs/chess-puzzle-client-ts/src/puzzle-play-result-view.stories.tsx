import {
  PUZZLE_PLAY_STORY_ARGS,
  PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE,
  type PuzzlePlayStoryArgs,
  type PuzzleScene,
  renderPuzzlePlayScene,
  STORY_LINE,
  STORY_NO_RESULT,
  STORY_RESULT,
  STORY_SOLVED,
  withScreenFrame,
} from '@libs/game-puzzle-client-ts/puzzle-screen-story.example';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ChessPuzzleBoard } from './chess-puzzle-board';
import {
  StoryChessPuzzleBoard,
  withChessPuzzleBoardContext,
} from './chess-puzzle-story.example';

/** The whole line played out, for the row that steps through it. */
const WHOLE_LINE: PuzzleScene = {
  fen: STORY_LINE.mate,
  plies: 6,
  lastAction: 'c3d5',
};

/**
 * The feed's `result` place: how the finished puzzle went, the rating it
 * made, and what next, under the board its puzzle feed plays on (chess's)
 * with the puzzle's last move.
 */
const meta = {
  id: 'screens-puzzles-play-result',
  title: 'Screens/Puzzles/Play/Result',
  component: ChessPuzzleBoard,
  tags: ['autodocs'],
  decorators: [withScreenFrame, withChessPuzzleBoardContext],
  render: (args, context) =>
    renderPuzzlePlayScene(args, context, StoryChessPuzzleBoard),
  parameters: {
    appRouter: true,
    controls: { exclude: [...PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE] },
    puzzleScene: WHOLE_LINE,
  },
  args: {
    ...PUZZLE_PLAY_STORY_ARGS,
    boardSizing: 'width',
    stage: 'finished',
    place: { screen: 'result' },
    statusKind: 'solved',
    status: 'solved',
    elapsedMs: 41_000,
    coach: { message: "Checkmate! That's Legal's mate." },
    ratingChange: 16,
    result: STORY_RESULT,
  },
} satisfies Meta<PuzzlePlayStoryArgs>;
export default meta;
// The render owns screen-fixture args; the production board owns this story slice.
type Story = StoryObj<Omit<typeof meta, 'component'>>;

/** Solved: the rating it earned, the streak, and the next puzzle. */
export const Solved: Story = {};

/** Solved after a wrong move: the board is solved, the attempt failed. */
export const Failed: Story = {
  args: {
    ratingChange: -9,
    result: {
      ...STORY_RESULT,
      completion: {
        ...STORY_SOLVED,
        outcome: 'failed',
        ratingAfter: 1491,
        delta: -9,
        streak: 0,
      },
      displayRating: 1491,
    },
  },
};

/** The solution was shown: the attempt failed, the line is a row away. */
export const SolutionShown: Story = {
  args: {
    ...Failed.args,
    statusKind: 'failed',
    status: 'revealed',
    hintStage: 'solution',
    coach: { message: 'The knight had to take on e5 first.' },
  },
};

/** Skipped: no rated outcome, the puzzle's own facts, and the next puzzle. */
export const Skipped: Story = {
  args: {
    statusKind: 'skipped',
    status: 'skipped',
    ratingChange: null,
    result: STORY_NO_RESULT,
  },
};

/** A repeat of a puzzle already rated: played again, never re-rated. */
export const Unrated: Story = {
  args: {
    ratingChange: 'unrated',
    result: {
      ...STORY_RESULT,
      completion: {
        ...STORY_SOLVED,
        delta: 0,
        ratingAfter: 1500,
        rated: false,
      },
      displayRating: 1500,
    },
  },
};

/** A new player's rating still carries its "?" marker. */
export const Provisional: Story = {
  args: { result: { ...STORY_RESULT, provisional: true } },
};

/** The puzzle's link was copied: the share command says so. */
export const LinkCopied: Story = {
  args: { share: { ...PUZZLE_PLAY_STORY_ARGS.share!, state: 'copied' } },
};

/** Copying failed: the share command says so and can be pressed again. */
export const LinkCopyFailed: Story = {
  args: { share: { ...PUZZLE_PLAY_STORY_ARGS.share!, state: 'failed' } },
};

/** The one filled command asks for the next puzzle. */
export const NextPuzzle: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('chess-puzzle-summary-next')
    );
    await expect(args.onNext).toHaveBeenCalled();
  },
};

/** Retry and Share are the quieter commands beside it. */
export const RetryAndShare: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('chess-puzzle-action-retry')
    );
    await expect(args.onRetry).toHaveBeenCalled();
    await userEvent.click(await canvas.findByTestId('chess-puzzle-share-link'));
    await expect(args.share?.onShare).toHaveBeenCalled();
  },
};

/** The line's row leaves the result for the board, and Back returns. */
export const StepThroughTheLine: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('chess-puzzle-summary-close')
    );
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'line' });
    await expect(
      await canvas.findByTestId('chess-puzzle-move-nav-back')
    ).toBeVisible();
    await expect(canvas.queryByTestId('chess-puzzle-summary')).toBeNull();
    await expect(
      await canvas.findByTestId('chess-puzzle-action-next')
    ).toBeVisible();
  },
};

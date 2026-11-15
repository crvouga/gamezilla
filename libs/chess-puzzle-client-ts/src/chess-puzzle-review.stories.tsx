import {
  PuzzleReviewScreenView,
  type PuzzleReviewScreenViewProps,
  STORY_LINE,
  STORY_PLIES,
  StoryReviewBoard,
} from '@libs/game-puzzle-client-ts/puzzle-screen-story.example';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ChessPuzzleBoard } from './chess-puzzle-board';
import {
  StoryChessReviewBoard,
  withChessPuzzleBoardContext,
} from './chess-puzzle-story.example';

/** Positions by how far into the line the review cursor stands. */
const POSITIONS = [
  STORY_LINE.start,
  STORY_LINE.start,
  STORY_LINE.afterNxe5,
  STORY_LINE.afterBxd1,
  STORY_LINE.afterBxf7,
  STORY_LINE.afterKe7,
  STORY_LINE.mate,
] as const;

type ReviewArgs = PuzzleReviewScreenViewProps;

/**
 * A played puzzle's review drawn on chess's own review board, as the app
 * shows it, so its pieces and coordinates match the solving screens.
 */
const meta = {
  id: 'screens-puzzles-chess-review',
  title: 'Screens/Puzzles/Chess/Review',
  component: ChessPuzzleBoard,
  tags: ['autodocs'],
  decorators: [withChessPuzzleBoardContext],
  render: (args: ReviewArgs, context) => {
    const cursor = Number(context.parameters['reviewCursor'] ?? 6);
    return (
      <PuzzleReviewScreenView
        {...args}
        board={
          <StoryReviewBoard
            plies={STORY_PLIES}
            selectedSolveIdx={cursor}
            board={(size) => (
              <StoryChessReviewBoard
                position={POSITIONS[cursor] ?? STORY_LINE.mate}
                testId="chess-puzzle-review-board"
                size={size}
              />
            )}
          />
        }
      />
    );
  },
  parameters: { appRouter: true, controls: { exclude: ['board'] } },
  args: {
    status: 'ready',
    outcome: 'solved',
    puzzleRating: 1702,
    onBackToLog: fn(),
  },
} satisfies Meta<ReviewArgs>;
export default meta;
// The render owns the review's args; the production board draws the position.
type Story = StoryObj<Omit<typeof meta, 'component'>>;

/** A solved puzzle replayed to its final, mating move. */
export const Solved: Story = {};

/** A failed puzzle, stepped back to the solver's first decision. */
export const Failed: Story = {
  args: { outcome: 'failed' },
  parameters: { reviewCursor: 1 },
};

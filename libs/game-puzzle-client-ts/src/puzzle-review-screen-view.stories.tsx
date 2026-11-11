import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  PuzzleReviewScreenView,
  type PuzzleReviewScreenViewProps,
} from './puzzle-review-screen-view';
import {
  STORY_LINE,
  STORY_PLIES,
  StoryPuzzleBoard,
  StoryReviewBoard,
} from './puzzle-screen-story.example';

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

/** The replay board and move list at the story's cursor, fresh per mount. */
function renderAt(
  args: PuzzleReviewScreenViewProps,
  context: { parameters: Record<string, unknown> }
) {
  const cursor = Number(context.parameters['reviewCursor'] ?? 6);
  return (
    <PuzzleReviewScreenView
      {...args}
      board={
        <StoryReviewBoard
          plies={STORY_PLIES}
          selectedSolveIdx={cursor}
          board={(size) => (
            <StoryPuzzleBoard
              position={POSITIONS[cursor] ?? STORY_LINE.mate}
              testId="chess-puzzle-review-board"
              size={size}
            />
          )}
        />
      }
    />
  );
}

const meta = {
  id: 'screens-puzzles-review',
  title: 'Screens/Puzzles/Review',
  component: PuzzleReviewScreenView,
  tags: ['autodocs'],
  render: (args, context) => renderAt(args, context),
  parameters: { appRouter: true, controls: { exclude: ['board'] } },
  args: {
    status: 'ready',
    outcome: 'solved',
    puzzleRating: 1702,
    onBackToLog: fn(),
  },
} satisfies Meta<typeof PuzzleReviewScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A solved puzzle replayed to its final, mating move. */
export const Solved: Story = {};

/** A failed puzzle, stepped back to the solver's first decision. */
export const Failed: Story = {
  args: { outcome: 'failed' },
  parameters: { reviewCursor: 1 },
};

/** An abandoned puzzle, halfway through its line. */
export const Abandoned: Story = {
  args: { outcome: 'abandoned' },
  parameters: { reviewCursor: 3 },
};

/** The log does not have the attempt yet: the generic title, no rating. */
export const Untitled: Story = { args: { outcome: null, puzzleRating: 0 } };

/** The puzzle is not on this device yet; the way back to the log is offered. */
export const Unavailable: Story = { args: { status: 'unavailable' } };

/** Nothing picked from the game log yet; the way back to it is offered. */
export const Unselected: Story = { args: { status: 'unselected' } };

/** Inside the personal stats route: the host scrolls and pads the page. */
export const Nested: Story = { args: { nested: true } };

/** A review that cannot show leads back to the game log. */
export const BackToLog: Story = {
  args: { status: 'unavailable' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Back to the game log' })
    );
    await expect(args.onBackToLog).toHaveBeenCalled();
  },
};

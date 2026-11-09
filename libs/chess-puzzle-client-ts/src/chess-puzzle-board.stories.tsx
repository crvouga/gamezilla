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
  assertPuzzleBounds,
  checkPuzzleFirstRank,
} from './chess-puzzle-bounds.example';
import { assertStablePuzzleRectangle } from './chess-puzzle-geometry.example';
import { ChessPuzzleJourney } from './chess-puzzle-journey.example';
import {
  completeChessPuzzle,
  recoverChessPuzzle,
} from './chess-puzzle-journey-play.example';
import {
  StoryChessPuzzleBoard,
  withChessPuzzleBoardContext,
} from './chess-puzzle-story.example';
import { puzzleRectangle } from './puzzle-rectangle.example';

/**
 * Chess's puzzle play: the platform's puzzle screen with chess's own
 * puzzle board, on the same fixed line (Legal's mate) as the platform's
 * play stories.
 */
const meta = {
  id: 'screens-puzzles-chess-play',
  title: 'Screens/Puzzles/Chess/Play',
  component: ChessPuzzleBoard,
  tags: ['autodocs'],
  decorators: [withScreenFrame, withChessPuzzleBoardContext],
  render: (_args, context) =>
    renderPuzzlePlayScene(
      {
        ...PUZZLE_PLAY_STORY_ARGS,
        boardSizing: 'width',
        ...(context.parameters['view'] as
          | Partial<PuzzlePlayStoryArgs>
          | undefined),
      },
      context,
      StoryChessPuzzleBoard
    ),
  parameters: {
    appRouter: true,
    controls: {
      disable: true,
      exclude: [...PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE],
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj;

/** The solver's turn after the setup move: find the best move for White. */
export const Solving: Story = {
  play: async ({ canvasElement }) => checkPuzzleFirstRank(canvasElement),
};

/** The first hint: the knight to move is marked on chess's board. */
export const Hint: Story = {
  play: async ({ canvasElement }) => checkPuzzleFirstRank(canvasElement),
  parameters: {
    view: {
      hintStage: 'highlight',
      coach: {
        message: 'Look at the knight on f3. What can it take?',
        contextKey: 'hint',
      },
    },
    puzzleScene: {
      fen: STORY_LINE.start,
      plies: 1,
      lastAction: 'g7g6',
      marks: { wrong: null, hint: 'f3', solution: null },
    },
  },
};

/** The solution shown as an arrow on chess's board. */
export const SolutionShown: Story = {
  play: async ({ canvasElement }) => {
    await assertPuzzleBounds(canvasElement);
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Solution shown')).toBeVisible();
    await expect(canvas.queryByText('Failed')).toBeNull();
    await expect(
      canvas.getByRole('button', {
        name: /f3, White knight, Solution: move from f3 to e5/,
      })
    ).toBeVisible();
    await expect(
      canvas.getByRole('button', {
        name: /e5, Black pawn, Solution destination: e5/,
      })
    ).toBeVisible();
  },
  parameters: {
    view: {
      statusKind: 'failed',
      status: 'revealed',
      hintStage: 'solution',
      coach: { message: 'Knight takes e5, even with the queen pinned.' },
    },
    puzzleScene: {
      fen: STORY_LINE.start,
      plies: 1,
      lastAction: 'g7g6',
      over: true,
      marks: { wrong: null, hint: null, solution: { from: 'f3', to: 'e5' } },
    },
  },
};

/** Complete the recorded mating line through the real board's keyboard input. */
export const SolveJourney: Story = {
  render: () => <ChessPuzzleJourney />,
  play: async ({ canvasElement }) => completeChessPuzzle(canvasElement),
};

/** A wrong move remains visible until Retry restores the position, then solve. */
export const WrongMoveRecovery: Story = {
  render: () => <ChessPuzzleJourney />,
  play: async ({ canvasElement }) => recoverChessPuzzle(canvasElement),
};

/** Expanded help must leave every piece reachable before any board input. */
export const KeyboardHelp: Story = {
  play: async ({ canvasElement }) => {
    await assertPuzzleBounds(canvasElement);
    const canvas = within(canvasElement);
    const initial = puzzleRectangle(canvasElement);
    await userEvent.click(canvas.getByText('Keyboard controls'));
    await assertStablePuzzleRectangle(canvasElement, initial, 'keyboard-help');
    await assertPuzzleBounds(canvasElement);
    await expect(
      canvas.getByText('Arrows to move, Enter to choose, Escape to cancel.')
    ).toBeVisible();
  },
};

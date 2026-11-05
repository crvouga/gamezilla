import {
  PUZZLE_PLAY_STORY_ARGS,
  PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE,
  type PuzzlePlayStoryArgs,
  renderPuzzlePlayScene,
  STORY_LINE,
  withScreenFrame,
} from '@libs/game-puzzle-client-ts/puzzle-screen-story.example';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ChessPuzzleBoard } from './chess-puzzle-board';
import {
  StoryChessPuzzleBoard,
  withChessPuzzleBoardContext,
} from './chess-puzzle-story.example';

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
export const Solving: Story = {};

/** The first hint: the knight to move is marked on chess's board. */
export const Hint: Story = {
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

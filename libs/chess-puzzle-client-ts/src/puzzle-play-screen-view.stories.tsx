import {
  PUZZLE_PLAY_STORY_ARGS,
  PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE,
  type PuzzlePlayStoryArgs,
  type PuzzleScene,
  renderPuzzlePlayScene,
  STORY_FEED_CONFIG,
  STORY_LINE,
  STORY_SOLVED,
  withScreenFrame,
} from '@libs/game-puzzle-client-ts/puzzle-screen-story.example';
import { ClockIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ChessPuzzleBoard } from './chess-puzzle-board';
import {
  StoryChessPuzzleBoard,
  withChessPuzzleBoardContext,
} from './chess-puzzle-story.example';

const SOLVING: PuzzleScene = {
  fen: STORY_LINE.start,
  plies: 1,
  lastAction: 'g7g6',
};
const SOLVED = STORY_SOLVED;

/**
 * The platform's puzzle play screen in each of its states, drawn with the
 * board its puzzle feed plays on (chess's), so a state's board looks the
 * way it will in the app and the same from one state to the next.
 */
const meta = {
  id: 'screens-puzzles-play',
  title: 'Screens/Puzzles/Play',
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

/** The solution is shown as an arrow; the attempt no longer counts as solved. */
export const SolutionShown: Story = {
  args: {
    statusKind: 'failed',
    status: 'revealed',
    hintStage: 'solution',
    coach: { message: 'Knight takes e5, even with the queen pinned.' },
  },
  parameters: {
    puzzleScene: {
      fen: STORY_LINE.start,
      plies: 1,
      lastAction: 'g7g6',
      over: true,
      marks: { wrong: null, hint: null, solution: { from: 'f3', to: 'e5' } },
    },
  },
};

/** Solved: the result overlay with the rating it earned and the next puzzle. */
export const Solved: Story = {
  args: {
    statusKind: 'solved',
    status: 'solved',
    elapsedMs: 41_000,
    coach: { message: "Checkmate! That's Legal's mate." },
  },
  parameters: {
    puzzleScene: {
      fen: STORY_LINE.mate,
      plies: 6,
      lastAction: 'c3d5',
      over: true,
      ratingChange: 16,
      completion: SOLVED,
    },
  },
};

/** Failed: the result overlay with the rating it cost. */
export const Failed: Story = {
  args: {
    statusKind: 'failed',
    status: 'revealed',
    hintStage: 'solution',
    elapsedMs: 63_000,
    coach: { message: 'The knight had to take on e5 first.' },
  },
  parameters: {
    puzzleScene: {
      fen: STORY_LINE.mate,
      plies: 6,
      lastAction: 'c3d5',
      over: true,
      ratingChange: -9,
      completion: {
        ...SOLVED,
        outcome: 'failed',
        ratingAfter: 1491,
        delta: -9,
        streak: 0,
      },
    },
  },
};

/** A repeat of a puzzle already rated: played again, never re-rated. */
export const Unrated: Story = {
  args: { ...Solved.args },
  parameters: {
    puzzleScene: {
      fen: STORY_LINE.mate,
      plies: 6,
      lastAction: 'c3d5',
      over: true,
      ratingChange: 'unrated',
    },
  },
};

/** Rated puzzles are limited: the feed says how many are left today. */
export const RatedAllowance: Story = {
  parameters: {
    puzzleScene: {
      ...SOLVING,
      allowanceLabel: '2 rated puzzles remaining today',
    },
  },
};

/** The rated limit is reached: the denial fills the board well. */
export const RatedLimitDenied: Story = {
  args: {
    pick: 'limited',
    statusKind: 'limited',
    solverSide: null,
    coach: {
      message:
        "That's all the puzzles for now. The board opens again when your allowance resets.",
    },
    elapsedMs: null,
    status: 'loading',
    denial: {
      icon: ClockIcon,
      title: "You've hit today's puzzle limit",
      body: 'Resets in 5 hours.',
      action: { label: 'See plans', onPress: fn() },
      dataSet: { testid: 'chess-puzzle-limit', reason: 'quota_exhausted' },
    },
  },
};

/** A pick is pending: one activity indicator in the board well. */
export const Loading: Story = {
  args: {
    pick: 'loading',
    statusKind: 'loading',
    solverSide: null,
    coach: { message: '' },
    coachResolving: true,
    elapsedMs: null,
    status: 'loading',
  },
};

/** Nothing synced and no connection: the feed waits to come back online. */
export const Offline: Story = {
  args: {
    ...Loading.args,
    pick: 'offline',
    statusKind: 'offline',
    coachResolving: false,
    coach: {
      message:
        "I can't fetch puzzles without a connection. Come back online and we'll pick up here.",
    },
  },
};

/** Every matching puzzle is played: widen the feed or adjust it. */
export const Empty: Story = {
  args: {
    ...Loading.args,
    pick: 'empty',
    statusKind: 'empty',
    coachResolving: false,
    coach: {
      message:
        "You've cleared everything in your feed. Widen the filters and let's keep going.",
    },
  },
};

/** "Failed" history with nothing failed yet: the feed explains why it is empty. */
export const EmptyNoFailedYet: Story = {
  args: {
    ...Empty.args,
    feedConfig: { ...STORY_FEED_CONFIG, historyFilter: 'failed' },
  },
};

/** Spectating before the host starts: waiting for the host. */
export const WaitingForHost: Story = {
  args: {
    ...Loading.args,
    pick: 'waiting',
    statusKind: 'waiting',
    coachResolving: false,
    coach: { message: 'Waiting for the host to start a puzzle.' },
  },
};

/** Watching the host solve: no feed or actions, the allowance line instead. */
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

/**
 * Story-only fixtures for the puzzle play and review screen views: the
 * plain data their containers wire from the room (the feed settings, the
 * line, the result), the place machine a story walks, and a game-agnostic
 * board drawing a fixed puzzle line (Legal's mate) on the design system's
 * checkered board. The platform knows no game, so the stories use no
 * game's own board. Production never imports this module.
 */
import type { PuzzleCompletion } from '@libs/game-puzzle-shared-ts/completion';
import { DEFAULT_PUZZLE_FEED_CONFIG } from '@libs/game-puzzle-shared-ts/feed-config';
import type { PuzzleHistoryPly } from '@libs/game-puzzle-shared-ts/move-history';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { BoardFit } from '@pkgs/ui-root-client-ts/board-fit';
import {
  CellGridBoard,
  type CellGridCell,
} from '@pkgs/ui-root-client-ts/cell-grid-board';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { fn } from 'storybook/test';
import { createJSXDecorator } from 'storybook-solidjs-vite';
import type { PuzzleBoardMarks } from './puzzle-client';
import { PuzzleMoveHistory } from './puzzle-move-history';
import {
  STORY_FEED,
  useStoryFeedSettings,
  useStoryPuzzlePlaces,
} from './puzzle-places-story.example';
import type {
  PuzzleLineModel,
  PuzzlePlayScreenViewProps,
  PuzzleResultModel,
} from './puzzle-play-screen-model';
import { PuzzlePlayScreenView } from './puzzle-play-screen-view';
import type { PuzzleMoveWriting } from './use-puzzle-notation';

/** The feed as a new player first sees it: automatic, unseen puzzles. */
export const STORY_FEED_CONFIG = DEFAULT_PUZZLE_FEED_CONFIG;

export { STORY_FEED };

/** Moves written as the game names them, numbered on the mover's turn. */
const WRITING: PuzzleMoveWriting = {
  notation: () => 'san',
  format: (label) => label,
  moveNumber: (before, plyIndex) => {
    const fields = before.split(' ');
    const number = fields[5] ?? '1';
    if (fields[1] === 'b') return plyIndex === 0 ? `${number}…` : null;
    return `${number}.`;
  },
};

const noop = (): void => {};

/**
 * Decorator: the room the app frame's content region leaves (its height
 * held, never more), so a screen whose board takes the room its chrome
 * leaves (play) has a definite room to measure, as in the app, and sits
 * under the frame's header (an open space's top bar) rather than over it.
 */
export const withScreenFrame = createJSXDecorator((Story) => (
  <StackVertical grow minHeight="none">
    <Story />
  </StackVertical>
));

/** The review surface: the game's board over the line's move list. */
export function StoryReviewBoard(props: {
  readonly plies: readonly PuzzleHistoryPly[];
  readonly selectedSolveIdx: number;
  readonly board: (size: number) => JSX.Element;
}): JSX.Element {
  return (
    <BoardFit
      height="bounded"
      testId={Handles.chessPuzzleBoardFrame}
      footer={
        <PuzzleMoveHistory
          plies={props.plies}
          selectedSolveIdx={props.selectedSolveIdx}
          interactive
          writing={WRITING}
          onSeek={noop}
          nav={{
            canGoBack: props.selectedSolveIdx > 0,
            canGoForward: props.selectedSolveIdx < props.plies.length,
            onNavigate: noop,
          }}
        />
      }
    >
      {(size) => props.board(size)}
    </BoardFit>
  );
}

/** The position before the setup move, Black to play 4…g6. */
const SETUP_POSITION =
  'rn1qkbnr/ppp2ppp/3p4/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R b KQkq - 3 4';

/** Each position of the fixed line, from the solver's first turn to mate. */
export const STORY_LINE = {
  start:
    'rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5',
  afterNxe5:
    'rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P1b1/2N5/PPPP1PPP/R1BQK2R b KQkq - 0 5',
  afterBxd1:
    'rn1qkbnr/ppp2p1p/3p2p1/4N3/2B1P3/2N5/PPPP1PPP/R1BbK2R w KQkq - 0 6',
  afterBxf7: 'rn1qkbnr/ppp2B1p/3p2p1/4N3/4P3/2N5/PPPP1PPP/R1BbK2R b KQkq - 0 6',
  afterKe7: 'rn1q1bnr/ppp1kB1p/3p2p1/4N3/4P3/2N5/PPPP1PPP/R1BbK2R w KQ - 1 7',
  mate: 'rn1q1bnr/ppp1kB1p/3p2p1/3NN3/4P3/8/PPPP1PPP/R1BbK2R b KQ - 2 7',
  /** The tempting wrong first move. */
  wrong:
    'rn1qkbnr/ppp2p1p/3p2p1/3Np3/2B1P1b1/5N2/PPPP1PPP/R1BQK2R b KQkq - 1 5',
} as const;

/** The line's moves as the move list shows them, setup move first. */
export const STORY_PLIES: readonly PuzzleHistoryPly[] = [
  { plyIndex: 0, solveIdxAfter: 1, label: 'g6', before: SETUP_POSITION },
  { plyIndex: 1, solveIdxAfter: 2, label: 'Nxe5', before: STORY_LINE.start },
  {
    plyIndex: 2,
    solveIdxAfter: 3,
    label: 'Bxd1',
    before: STORY_LINE.afterNxe5,
  },
  {
    plyIndex: 3,
    solveIdxAfter: 4,
    label: 'Bxf7+',
    before: STORY_LINE.afterBxd1,
  },
  { plyIndex: 4, solveIdxAfter: 5, label: 'Ke7', before: STORY_LINE.afterBxf7 },
  { plyIndex: 5, solveIdxAfter: 6, label: 'Nd5#', before: STORY_LINE.afterKe7 },
];

/**
 * Each piece as one filled figure (text presentation, never emoji), its side
 * told by the board's light and dark piece inks and by its label.
 */
const PIECES: Readonly<
  Record<string, { glyph: string; name: string; side: 'one' | 'two' }>
> = {
  K: { glyph: '\u265A\uFE0E', name: 'white king', side: 'one' },
  Q: { glyph: '\u265B\uFE0E', name: 'white queen', side: 'one' },
  R: { glyph: '\u265C\uFE0E', name: 'white rook', side: 'one' },
  B: { glyph: '\u265D\uFE0E', name: 'white bishop', side: 'one' },
  N: { glyph: '\u265E\uFE0E', name: 'white knight', side: 'one' },
  P: { glyph: '\u265F\uFE0E', name: 'white pawn', side: 'one' },
  k: { glyph: '\u265A\uFE0E', name: 'black king', side: 'two' },
  q: { glyph: '\u265B\uFE0E', name: 'black queen', side: 'two' },
  r: { glyph: '\u265C\uFE0E', name: 'black rook', side: 'two' },
  b: { glyph: '\u265D\uFE0E', name: 'black bishop', side: 'two' },
  n: { glyph: '\u265E\uFE0E', name: 'black knight', side: 'two' },
  p: { glyph: '\u265F\uFE0E', name: 'black pawn', side: 'two' },
};
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

/** One rank of a position's placement, expanded to eight squares. */
function rankSquares(rank: string): readonly string[] {
  return [...rank].flatMap((symbol) =>
    /\d/.test(symbol) ? Array<string>(Number(symbol)).fill('') : [symbol]
  );
}

function cellOf(
  square: string,
  symbol: string,
  marks: PuzzleBoardMarks
): CellGridCell {
  const piece = PIECES[symbol];
  const wrong = marks.wrong === square;
  const hinted =
    marks.hint === square ||
    marks.solution?.from === square ||
    marks.solution?.to === square;
  return {
    id: square,
    glyph: piece?.glyph ?? '',
    label: `${square}, ${piece?.name ?? 'empty'}${wrong ? ', wrong move' : ''}${hinted ? ', hint' : ''}`,
    tone: wrong ? 'critical' : piece === undefined ? 'open' : 'occupied',
    emphasis: wrong ? 'refused' : hinted ? 'pending' : 'none',
    identity: piece?.side,
    enabled: false,
  };
}

/** A position's squares, a8 first, with the attempt's marks. */
function positionCells(
  position: string,
  marks: PuzzleBoardMarks
): readonly CellGridCell[] {
  const placement = (position.split(' ')[0] ?? '').split('/');
  return RANKS.flatMap((rank, row) => {
    const squares = rankSquares(placement[row] ?? '8');
    return FILES.map((file, column) =>
      cellOf(`${file}${rank}`, squares[column] ?? '', marks)
    );
  });
}

const NO_MARKS: PuzzleBoardMarks = { wrong: null, hint: null, solution: null };

/** What a story's board draws: a position, its marks, at the well's size. */
export type StoryPuzzleBoardProps = {
  readonly position: string;
  readonly testId: string;
  readonly marks?: PuzzleBoardMarks | undefined;
  /** The board well's size, px; a board that fills its box may ignore it. */
  readonly size: number;
  /** The line's move that led to `position`, for the board to mark. */
  readonly lastAction?: string | null | undefined;
};

/**
 * A puzzle position on the design system's checkered board, standing in for
 * a game's board: wooden squares, pieces filling most of a square.
 */
export function StoryPuzzleBoard(props: StoryPuzzleBoardProps): JSX.Element {
  return (
    <CellGridBoard
      boardTheme="checkered"
      label="Puzzle position"
      testId={props.testId}
      columnLabels={FILES}
      rowLabels={RANKS}
      cells={positionCells(props.position, props.marks ?? NO_MARKS)}
    />
  );
}

/** What the board's screens draw for one state: the position and the line. */
export type PuzzleScene = {
  readonly fen: string;
  readonly marks?: PuzzleBoardMarks;
  /** How many moves of the line were reached. */
  readonly plies: number;
  /** The move the board is on; the latest when unset. */
  readonly selected?: number;
  /** The line's move that led to `fen` (UCI), marked on the board. */
  readonly lastAction?: string;
};

/** A solved puzzle that raised the rating, for the result. */
export const STORY_SOLVED: PuzzleCompletion = {
  outcome: 'solved',
  ratingBefore: 1500,
  ratingAfter: 1516,
  delta: 16,
  streak: 3,
  puzzleRating: 1702,
  rated: true,
};

/** The solver's turn after the setup move, the line's opening state. */
const SOLVING_SCENE: PuzzleScene = {
  fen: STORY_LINE.start,
  plies: 1,
  lastAction: 'g7g6',
};

/** The result of a puzzle nobody has finished. */
export const STORY_NO_RESULT: PuzzleResultModel = {
  completion: null,
  displayRating: 0,
  provisional: false,
  puzzleRating: 1702,
  themes: ['mate', 'opening', 'sacrifice'],
};

/** The result of the solved puzzle. */
export const STORY_RESULT: PuzzleResultModel = {
  ...STORY_NO_RESULT,
  completion: STORY_SOLVED,
  displayRating: STORY_SOLVED.ratingAfter,
};

/** The line with `count` moves reached, the board on `selected`. */
export function storyLine(args: {
  readonly count: number;
  readonly selected?: number | undefined;
  readonly awaiting?: boolean | undefined;
}): PuzzleLineModel {
  const selected = args.selected ?? args.count;
  return {
    plies: STORY_PLIES.slice(0, args.count),
    selectedSolveIdx: selected,
    interactive: true,
    awaiting: args.awaiting === true,
    writing: WRITING,
    nav: {
      canGoBack: selected > 0,
      canGoForward: selected < args.count,
      onNavigate: noop,
    },
    onSeek: noop,
  };
}

/** The play view's slots a story fills itself, hidden from Controls. */
export const PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE = [
  'coach',
  'speaker',
  'legend',
  'board',
  'line',
  'feed',
  'result',
  'share',
  'denial',
  'notices',
  'probe',
  'overlay',
] as const;

/** The play view's props, for a game's own puzzle stories. */
export type PuzzlePlayStoryArgs = PuzzlePlayScreenViewProps;

/**
 * The puzzle play screen for a game's own stories (chess draws its real
 * puzzle board in it), through this story-fixture module rather than the
 * framework's implementation.
 */
export { PuzzlePlayScreenView, type PuzzlePlayScreenViewProps };

/** The play view solving the line's first move, every callback a spy. */
export const PUZZLE_PLAY_STORY_ARGS: PuzzlePlayScreenViewProps = {
  stage: 'playing',
  place: { screen: 'play' },
  onOpen: fn(),
  onBack: fn(),
  statusKind: 'started',
  solverSide: 'White',
  coach: {
    message: 'Something on the board is undefended.',
    contextKey: 'start',
  },
  elapsedMs: 12_000,
  spectator: false,
  allowanceLabel: '',
  ratingChange: null,
  line: storyLine({ count: 1, awaiting: true }),
  status: 'solving',
  hintStage: 'none',
  canGoForward: false,
  onHint: fn(),
  onSolution: fn(),
  onRetry: fn(),
  onSkip: fn(),
  onNext: fn(),
  onIncludeAllPuzzles: fn(),
  feed: STORY_FEED,
  result: STORY_NO_RESULT,
  share: { state: 'idle', onShare: fn() },
};

/** The play view walking its places, its slots filled from `scene`. */
function StoryPuzzlePlay(props: {
  readonly args: PuzzlePlayScreenViewProps;
  readonly scene: PuzzleScene;
  readonly Board: (props: StoryPuzzleBoardProps) => JSX.Element;
}): JSX.Element {
  const places = useStoryPuzzlePlaces({
    stage: () => props.args.stage,
    place: () => props.args.place,
    onOpen: (place) => props.args.onOpen(place),
    onBack: () => props.args.onBack(),
  });
  const feed = useStoryFeedSettings(() => props.args.feed, places.home);
  const Board = props.Board;
  return (
    <PuzzlePlayScreenView
      {...props.args}
      place={places.place()}
      onOpen={places.onOpen}
      onBack={places.onBack}
      feed={feed()}
      line={storyLine({
        count: props.scene.plies,
        selected: props.scene.selected,
        awaiting: props.args.status === 'solving',
      })}
      board={(size) => (
        <Board
          position={props.scene.fen}
          testId="chess-puzzle-board"
          marks={props.scene.marks}
          size={size}
          lastAction={props.scene.lastAction ?? null}
        />
      )}
    />
  );
}

/**
 * The play view with its slots filled from the story's `puzzleScene`
 * parameter, fresh per mount: the line so far and `Board` drawing the
 * position (the platform's stand-in, or a game's own board). The place is
 * walked on the real machine, from the story's `place` arg.
 */
export function renderPuzzlePlayScene(
  args: PuzzlePlayScreenViewProps,
  context: { readonly parameters: Record<string, unknown> },
  Board: (props: StoryPuzzleBoardProps) => JSX.Element
): JSX.Element {
  const scene =
    (context.parameters['puzzleScene'] as PuzzleScene | undefined) ??
    SOLVING_SCENE;
  return <StoryPuzzlePlay args={args} scene={scene} Board={Board} />;
}

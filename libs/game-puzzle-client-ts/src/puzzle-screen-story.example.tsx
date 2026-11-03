/**
 * Story-only fixtures for the puzzle play and review screen views: the
 * presentational widgets their containers put in the views' slots (feed
 * strip, result overlay, move list) and a game-agnostic board drawing a
 * fixed puzzle line (Legal's mate) on the design system's cell grid. The
 * platform knows no game, so the stories use no game's own board.
 * Production never imports this module.
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
import { Layer } from '@pkgs/ui-root-client-ts/layer';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { createJSXDecorator } from 'storybook-solidjs-vite';
import { PuzzleCelebrationOverlayView } from './puzzle-celebration-overlay-view';
import type { PuzzleBoardMarks } from './puzzle-client';
import {
  PuzzleFeedBarView,
  type PuzzleFeedRatingChange,
} from './puzzle-feed-bar-view';
import { PuzzleMoveHistory } from './puzzle-move-history';
import type { PuzzleMoveWriting } from './use-puzzle-notation';

/** The feed as a new player first sees it: automatic, unseen puzzles. */
export const STORY_FEED_CONFIG = DEFAULT_PUZZLE_FEED_CONFIG;

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
 * Decorator: a fixed full-viewport frame (with the canvas held at that
 * height), so a screen whose board takes the room its chrome leaves (play)
 * has a definite room to measure, as in the app.
 */
export const withScreenFrame = createJSXDecorator((Story) => (
  <StackVertical minHeight="screen">
    <Layer inset="viewport">
      <Story />
    </Layer>
  </StackVertical>
));

/** The feed strip above the board, with a typical feed and pool. */
export function StoryFeedBar(props: {
  readonly puzzleId?: string | undefined;
  readonly rating?: number | undefined;
  readonly themes?: readonly string[] | undefined;
  readonly over?: boolean | undefined;
  readonly ratingChange?: PuzzleFeedRatingChange | undefined;
  readonly allowanceLabel?: string | undefined;
}): JSX.Element {
  return (
    <PuzzleFeedBarView
      puzzleId={props.puzzleId}
      rating={props.rating}
      themes={props.themes}
      over={props.over}
      ratingChange={props.ratingChange ?? null}
      config={STORY_FEED_CONFIG}
      configReady
      effectiveRating={1500}
      matched={1240}
      total={3000}
      allowanceLabel={props.allowanceLabel ?? ''}
      themeLabel={(theme) => theme}
      onOpenFeedSettings={noop}
    />
  );
}

/** The result of a finished puzzle, shown over the board. */
export function StoryCelebration(props: {
  readonly completion: PuzzleCompletion;
  readonly provisional?: boolean | undefined;
  readonly onNext?: (() => void) | undefined;
}): JSX.Element {
  return (
    <PuzzleCelebrationOverlayView
      completion={props.completion}
      displayRating={props.completion.ratingAfter}
      provisional={props.provisional === true}
      visible
      onClose={noop}
      onNext={props.onNext ?? noop}
    />
  );
}

/** The move list under the play board, on its latest move. */
export function StoryTimeline(props: {
  readonly plies: readonly PuzzleHistoryPly[];
  readonly selectedSolveIdx?: number | undefined;
}): JSX.Element {
  return (
    <PuzzleMoveHistory
      plies={props.plies}
      selectedSolveIdx={props.selectedSolveIdx ?? props.plies.length}
      interactive
      writing={WRITING}
      onSeek={noop}
      nav={{
        canGoBack: props.plies.length > 0,
        canGoForward: false,
        showStepControls: false,
        onNavigate: noop,
      }}
    />
  );
}

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
            showStepControls: true,
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

const PIECES: Readonly<Record<string, { glyph: string; name: string }>> = {
  K: { glyph: '♔', name: 'white king' },
  Q: { glyph: '♕', name: 'white queen' },
  R: { glyph: '♖', name: 'white rook' },
  B: { glyph: '♗', name: 'white bishop' },
  N: { glyph: '♘', name: 'white knight' },
  P: { glyph: '♙', name: 'white pawn' },
  k: { glyph: '♚', name: 'black king' },
  q: { glyph: '♛', name: 'black queen' },
  r: { glyph: '♜', name: 'black rook' },
  b: { glyph: '♝', name: 'black bishop' },
  n: { glyph: '♞', name: 'black knight' },
  p: { glyph: '♟', name: 'black pawn' },
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

/** A puzzle position on the design system's cell grid, standing in for a game's board. */
export function StoryPuzzleBoard(props: {
  readonly position: string;
  readonly testId: string;
  readonly marks?: PuzzleBoardMarks | undefined;
}): JSX.Element {
  return (
    <CellGridBoard
      label="Puzzle position"
      testId={props.testId}
      columnLabels={FILES}
      rowLabels={RANKS}
      cells={positionCells(props.position, props.marks ?? NO_MARKS)}
    />
  );
}

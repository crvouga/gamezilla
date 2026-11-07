import {
  type PuzzlePlayerProps,
  type PuzzlePreviewProps,
  usePuzzleLibraryNavigation,
} from '@libs/game-puzzle-client-ts/puzzle-content-client';
import {
  puzzleProgress,
  readPuzzle,
  type WordTilesPuzzle,
} from '@libs/word-tiles-shared-ts/word-tiles-puzzle';
import { t } from '@lingui/core/macro';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { WordTileBoard } from '@pkgs/ui-root-client-ts/word-tile-board';
import { createMemo, type JSX, Show } from 'solid-js';
import { useWordTilesLexicon } from './use-word-tiles-lexicon';
import { newCandidate } from './word-tiles-candidate';
import {
  boardCells,
  COLUMN_LABELS,
  ROW_LABELS,
  squareText,
} from './word-tiles-cells';
import {
  framePosition,
  WordTilesPuzzlePlayerView,
} from './word-tiles-puzzle-player-view';

/** The challenge's status: the target, then what the last move scored. */
export function wordTilesPuzzleStatus(
  definition: string,
  state: string
): string | null {
  const read = readPuzzle(definition);
  if (!read.valid) return null;
  const target = read.value.target;
  const score = puzzleProgress(state).score;
  return score === null
    ? t`Score at least ${target} points in one move.`
    : t`Your last move scored ${score} of ${target}.`;
}

/** One-move challenge: the shared player keeps the attempt; this board makes each move. */
export function WordTilesPuzzlePlayer(props: PuzzlePlayerProps): JSX.Element {
  const openLibrary = usePuzzleLibraryNavigation();
  const puzzle = createMemo(() => readPuzzle(props.definition));
  const lexicon = useWordTilesLexicon(() => {
    const read = puzzle();
    return read.valid ? read.value.lexicon : '';
  });
  return (
    <WordTilesPuzzlePlayerView
      {...props}
      onReturnToLibrary={openLibrary}
      lexicon={lexicon.state()}
      onRetryLexicon={lexicon.retry}
    />
  );
}

/** The board, rack and target, without any moves. */
export function WordTilesPuzzlePreview(props: PuzzlePreviewProps): JSX.Element {
  const puzzle = createMemo(() => readPuzzle(props.definition));
  return (
    <Show
      when={(() => {
        const read = puzzle();
        return read.valid ? read.value : null;
      })()}
      fallback={<P>{t`This puzzle cannot be shown.`}</P>}
    >
      {(read) => <PreviewBoard puzzle={read()} />}
    </Show>
  );
}

function PreviewBoard(props: { puzzle: WordTilesPuzzle }): JSX.Element {
  const empty = newCandidate('', null);
  const cells = createMemo(() =>
    boardCells(framePosition(props.puzzle), empty, false)
  );
  return (
    <StackVertical gap="sm">
      <WordTileBoard
        label={t`Puzzle board, fifteen columns and fifteen rows`}
        testId="word-tiles-puzzle-preview"
        columnLabels={COLUMN_LABELS}
        rowLabels={ROW_LABELS}
        cells={cells()}
        squareText={squareText}
      />
      <P>
        {t`Rack: ${props.puzzle.rack.replaceAll('?', '·')}. Target: ${props.puzzle.target} points.`}
      </P>
    </StackVertical>
  );
}

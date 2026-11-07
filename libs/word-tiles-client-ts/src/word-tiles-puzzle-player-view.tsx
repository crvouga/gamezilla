import type { PuzzlePlayerProps } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { parseCell } from '@libs/word-tiles-shared-ts/word-tiles-board';
import {
  encodePosition,
  newPosition,
  type WordTilesPosition,
} from '@libs/word-tiles-shared-ts/word-tiles-position';
import {
  placementOf,
  puzzleProgress,
  rackTileIds,
  readPuzzle,
  type WordTilesPuzzle,
} from '@libs/word-tiles-shared-ts/word-tiles-puzzle';
import { t } from '@lingui/core/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { TileRack } from '@pkgs/ui-root-client-ts/tile-rack';
import { WordTileBoard } from '@pkgs/ui-root-client-ts/word-tile-board';
import {
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  Show,
} from 'solid-js';
import type { LexiconState } from './use-word-tiles-lexicon';
import {
  assignBlank,
  type Candidate,
  candidateProposal,
  newCandidate,
  pressCell,
  pressTile,
  rebase,
  recallAll,
} from './word-tiles-candidate';
import {
  boardCells,
  COLUMN_LABELS,
  ROW_LABELS,
  rackTiles,
  squareText,
} from './word-tiles-cells';
import { WordTilesBlankChooser } from './word-tiles-panels';
import { previewCandidate } from './word-tiles-preview';
import { PuzzleBonusContext } from './word-tiles-puzzle-bonus-context';
import {
  PuzzlePlacementFeedback,
  UnreadablePuzzle,
} from './word-tiles-puzzle-feedback';
import { WordTilesPuzzleStatus } from './word-tiles-puzzle-status';

/** The frozen board as a position, so the game's own board pieces show it. */
export function framePosition(puzzle: WordTilesPuzzle): WordTilesPosition {
  return { ...newPosition(2, puzzle.lexicon), board: puzzle.board };
}

/** A candidate's proposal with the rack's stand-in tiles written as rack indices. */
export function puzzleAction(
  proposal: string,
  ids: readonly number[]
): string | null {
  if (!proposal.startsWith('play:')) return null;
  const entries = proposal
    .slice(5)
    .split('.')
    .map((entry) => {
      const match = /^([a-o]\d{1,2})=(\d+)([A-Z]?)$/.exec(entry);
      const index = match === null ? -1 : ids.indexOf(Number(match[2]));
      return match === null || index < 0
        ? null
        : `${match[1]}=${index}${match[3] ?? ''}`;
    });
  return entries.some((e) => e === null) ? null : `play:${entries.join('.')}`;
}

type PuzzleBoardProps = {
  puzzle: WordTilesPuzzle;
  disabled: boolean;
  state: string;
  lexicon: LexiconState;
  onAction: (action: string) => void;
  onRetryLexicon: () => void;
  onReturnToLibrary: () => void;
};

function createPuzzleBoard(props: PuzzleBoardProps) {
  const ids = createMemo(() => rackTileIds(props.puzzle.rack));
  const hand = () => ids().join(',');
  const base = () => encodePosition(framePosition(props.puzzle));
  const [candidate, setCandidate] = createSignal<Candidate>(
    newCandidate(base(), hand())
  );
  createEffect(
    on([base, hand], () => setCandidate((c) => rebase(c, base(), hand())))
  );
  const preview = createMemo(() =>
    previewCandidate(framePosition(props.puzzle), candidate(), props.lexicon)
  );
  const progress = () => puzzleProgress(props.state);
  const target = () => props.puzzle.target;
  const complete = () => (progress().score ?? 0) >= target();
  const editable = () => !props.disabled && !complete();
  const shownPosition = createMemo(() => {
    const position = framePosition(props.puzzle);
    if (!complete()) return position;
    const board = position.board.split('');
    for (const tile of placementOf(props.puzzle, progress().played ?? '') ?? [])
      board[tile.cell] = tile.blank ? tile.letter.toLowerCase() : tile.letter;
    return { ...position, board: board.join('') };
  });
  createEffect(
    on(
      () => props.state,
      () => setCandidate(recallAll),
      { defer: true }
    )
  );
  // Memoized: each square reads the list (see the game board).
  const cells = createMemo(() =>
    boardCells(shownPosition(), candidate(), editable())
  );
  const tiles = createMemo(() => rackTiles(candidate(), editable()));
  const submit = () => {
    const proposal = candidateProposal(candidate());
    const action = proposal === null ? null : puzzleAction(proposal, ids());
    if (action !== null) props.onAction(action);
  };
  return {
    submit,
    candidate,
    setCandidate,
    preview,
    progress,
    target,
    complete,
    editable,
    cells,
    tiles,
  };
}

function PuzzleBlank(props: {
  state: Pick<
    ReturnType<typeof createPuzzleBoard>,
    'candidate' | 'setCandidate' | 'cells' | 'target' | 'editable'
  >;
}): JSX.Element {
  return (
    <Show
      when={props.state.editable() && props.state.candidate().blankAt !== null}
    >
      <WordTilesBlankChooser
        testId="word-tiles-puzzle"
        cells={props.state.cells()}
        index={props.state.candidate().blankAt ?? 0}
        summary={t`Target: ${props.state.target()} points`}
        onCancel={() =>
          props.state.setCandidate((c) =>
            c.blankAt === null ? c : pressCell(c, c.blankAt)
          )
        }
        onChoose={(letter) =>
          props.state.setCandidate((c) => assignBlank(c, letter))
        }
      />
    </Show>
  );
}

function PuzzleBoard(props: PuzzleBoardProps): JSX.Element {
  const {
    submit,
    candidate,
    setCandidate,
    preview,
    progress,
    target,
    complete,
    editable,
    cells,
    tiles,
  } = createPuzzleBoard(props);
  const showPreview = () =>
    editable() &&
    candidate().blankAt === null &&
    props.lexicon.status === 'ready';
  return (
    <StackVertical gap="xs" padding="lg" width="full" maxWidth="prose">
      <WordTilesPuzzleStatus
        target={target()}
        score={progress().score}
        complete={complete()}
        disabled={props.disabled}
        lexicon={props.lexicon}
        onReturnToLibrary={props.onReturnToLibrary}
        onRetryLexicon={props.onRetryLexicon}
      />
      <Show when={!complete()}>
        <PuzzleBlank
          state={{ candidate, setCandidate, cells, target, editable }}
        />
        <Show when={showPreview()}>
          <PuzzlePlacementFeedback
            preview={preview()}
            target={target()}
            hasPlacement={
              candidate().placed.length > 0 && candidate().blankAt === null
            }
          />
        </Show>
        <StackHorizontal gap="sm" wrap>
          <Button
            title={t`Play word`}
            disabled={
              !editable() ||
              props.lexicon.status !== 'ready' ||
              !preview().playable
            }
            dataSet={{ testid: 'word-tiles-puzzle-submit' }}
            onClick={submit}
          />
          <Button
            title={t`Recall tiles`}
            variant="outline"
            intent="neutral"
            disabled={!editable() || candidate().placed.length === 0}
            dataSet={{ testid: 'word-tiles-puzzle-recall' }}
            onClick={() => setCandidate(recallAll)}
          />
        </StackHorizontal>
        <TileRack
          label={t`Your rack`}
          testId="word-tiles-puzzle-rack"
          tiles={tiles()}
          onActivate={(id) => {
            if (editable()) setCandidate((c) => pressTile(c, Number(id)));
          }}
        />
      </Show>
      <PuzzleBonusContext
        cell={cells().find(
          (cell) => parseCell(cell.id) === candidate().placed.at(-1)?.cell
        )}
      />
      <WordTileBoard
        measure="compact"
        label={t`Puzzle board, fifteen columns and fifteen rows`}
        testId="word-tiles-puzzle"
        columnLabels={COLUMN_LABELS}
        rowLabels={ROW_LABELS}
        cells={cells()}
        squareText={squareText}
        onActivate={(id) => {
          const cell = parseCell(id);
          if (editable() && cell !== null)
            setCandidate((c) => pressCell(c, cell));
        }}
      />
    </StackVertical>
  );
}

export type WordTilesPuzzlePlayerViewProps = PuzzlePlayerProps & {
  /** The word list the puzzle pins: loading, ready, or unavailable. */
  readonly lexicon: LexiconState;
  readonly onRetryLexicon: () => void;
  /** Open the existing puzzle library without changing the attempt. */
  readonly onReturnToLibrary: () => void;
};

/**
 * A one-move Word Tiles challenge, presentational: the target, the last
 * move's score, the frozen board and the rack, the move's preview against
 * the word list, and play or recall. `WordTilesPuzzlePlayer` loads the word
 * list the puzzle pins.
 */
export function WordTilesPuzzlePlayerView(
  props: WordTilesPuzzlePlayerViewProps
): JSX.Element {
  const puzzle = createMemo(() => readPuzzle(props.definition));
  return (
    <Show
      when={(() => {
        const read = puzzle();
        return read.valid ? read.value : null;
      })()}
      fallback={
        <UnreadablePuzzle onReturnToLibrary={props.onReturnToLibrary} />
      }
    >
      {(read) => (
        <PuzzleBoard
          puzzle={read()}
          disabled={props.disabled}
          state={props.state}
          lexicon={props.lexicon}
          onReturnToLibrary={props.onReturnToLibrary}
          onAction={props.onAction}
          onRetryLexicon={props.onRetryLexicon}
        />
      )}
    </Show>
  );
}

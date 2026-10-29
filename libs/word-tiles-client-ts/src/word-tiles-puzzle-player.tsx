import type {
  PuzzlePlayerProps,
  PuzzlePreviewProps,
} from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { parseCell } from '@libs/word-tiles-shared-ts/word-tiles-board';
import {
  encodePosition,
  newPosition,
  type WordTilesPosition,
} from '@libs/word-tiles-shared-ts/word-tiles-position';
import {
  puzzleProgress,
  rackTileIds,
  readPuzzle,
  type WordTilesPuzzle,
} from '@libs/word-tiles-shared-ts/word-tiles-puzzle';
import { t } from '@lingui/core/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
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
import { useWordTilesLexicon } from './use-word-tiles-lexicon';
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
import {
  WordTilesBlankChooser,
  WordTilesPreviewPanel,
} from './word-tiles-panels';
import { previewCandidate } from './word-tiles-preview';

/** The frozen board as a position, so the game's own board pieces show it. */
function framePosition(puzzle: WordTilesPuzzle): WordTilesPosition {
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

function PuzzleBoard(props: {
  puzzle: WordTilesPuzzle;
  disabled: boolean;
  state: string;
  onAction: (action: string) => void;
}): JSX.Element {
  const ids = createMemo(() => rackTileIds(props.puzzle.rack));
  const hand = () => ids().join(',');
  const base = () => encodePosition(framePosition(props.puzzle));
  const [candidate, setCandidate] = createSignal<Candidate>(
    newCandidate(base(), hand())
  );
  createEffect(
    on([base, hand], () => setCandidate((c) => rebase(c, base(), hand())))
  );
  const lexicon = useWordTilesLexicon(() => props.puzzle.lexicon);
  const preview = createMemo(() =>
    previewCandidate(framePosition(props.puzzle), candidate(), lexicon.state())
  );
  const progress = () => puzzleProgress(props.state);
  const target = () => props.puzzle.target;
  const editable = () => !props.disabled;
  // Memoized: each square reads the list (see the game board).
  const cells = createMemo(() =>
    boardCells(framePosition(props.puzzle), candidate(), editable())
  );
  const tiles = createMemo(() => rackTiles(candidate(), editable()));
  return (
    <StackVertical gap="sm">
      <P variant="bodyBold" dataSet={{ testid: 'word-tiles-puzzle-target' }}>
        {t`Score at least ${target()} points in one move.`}
      </P>
      <Show when={progress().score !== null}>
        <P role="status" dataSet={{ testid: 'word-tiles-puzzle-score' }}>
          {t`Your last move scored ${progress().score ?? 0} of ${target()}.`}
        </P>
      </Show>
      <WordTileBoard
        label={t`Puzzle board, fifteen columns and fifteen rows`}
        testId="word-tiles-puzzle"
        columnLabels={COLUMN_LABELS}
        rowLabels={ROW_LABELS}
        cells={cells()}
        squareText={squareText}
        onActivate={(id) => {
          const cell = parseCell(id);
          if (cell !== null) setCandidate((c) => pressCell(c, cell));
        }}
      />
      <TileRack
        label={t`Your rack`}
        testId="word-tiles-puzzle-rack"
        tiles={tiles()}
        onActivate={(id) => setCandidate((c) => pressTile(c, Number(id)))}
      />
      <Show when={candidate().blankAt !== null}>
        <WordTilesBlankChooser
          testId="word-tiles-puzzle"
          onChoose={(letter) => setCandidate((c) => assignBlank(c, letter))}
        />
      </Show>
      <WordTilesPreviewPanel preview={preview()} testId="word-tiles-puzzle" />
      <StackHorizontal gap="sm" wrap>
        <Button
          title={t`Play word`}
          disabled={props.disabled || !preview().playable}
          dataSet={{ testid: 'word-tiles-puzzle-submit' }}
          onClick={() => {
            const proposal = candidateProposal(candidate());
            const action =
              proposal === null ? null : puzzleAction(proposal, ids());
            if (action !== null) props.onAction(action);
          }}
        />
        <Button
          title={t`Recall tiles`}
          variant="outline"
          intent="neutral"
          disabled={candidate().placed.length === 0}
          dataSet={{ testid: 'word-tiles-puzzle-recall' }}
          onClick={() => setCandidate(recallAll)}
        />
      </StackHorizontal>
    </StackVertical>
  );
}

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
  const puzzle = createMemo(() => readPuzzle(props.definition));
  return (
    <Show
      when={(() => {
        const read = puzzle();
        return read.valid ? read.value : null;
      })()}
      fallback={
        <P>{t`This puzzle cannot be opened. Update the app to play it.`}</P>
      }
    >
      {(read) => (
        <PuzzleBoard
          puzzle={read()}
          disabled={props.disabled}
          state={props.state}
          onAction={props.onAction}
        />
      )}
    </Show>
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

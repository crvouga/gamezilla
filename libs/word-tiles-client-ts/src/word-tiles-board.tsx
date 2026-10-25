import { parseCell } from '@libs/word-tiles-shared-ts/word-tiles-board';
import {
  decodePosition,
  type WordTilesPosition,
} from '@libs/word-tiles-shared-ts/word-tiles-position';
import { t } from '@lingui/core/macro';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TileRack } from '@pkgs/ui-root-client-ts/tile-rack';
import { WordTileBoard } from '@pkgs/ui-root-client-ts/word-tile-board';
import { useRandom } from '@pkgs/uuid-client-ts/solid';
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
  redoEdit,
  shuffleRack,
  toggleExchange,
  undoEdit,
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
  WordTilesScoreboard,
} from './word-tiles-panels';
import { previewCandidate } from './word-tiles-preview';

type Model = {
  readonly props: GameBoardProps;
  readonly position: () => WordTilesPosition;
  readonly candidate: () => Candidate;
  readonly update: (change: (c: Candidate) => Candidate) => void;
  readonly editable: () => boolean;
};

function ExchangeControls(props: { model: Model }): JSX.Element {
  return (
    <Show
      when={props.model.candidate().exchange !== null}
      fallback={
        <Button
          title={t`Exchange tiles`}
          variant="outline"
          intent="neutral"
          disabled={
            !props.model.props.interactive || props.model.position().bag < 7
          }
          dataSet={{ testid: `${props.model.props.testId}-exchange` }}
          onClick={() => props.model.update(toggleExchange)}
        />
      }
    >
      <Button
        title={t`Exchange chosen tiles`}
        disabled={
          !props.model.props.interactive ||
          candidateProposal(props.model.candidate()) === null
        }
        dataSet={{ testid: `${props.model.props.testId}-exchange-confirm` }}
        onClick={() => {
          const proposal = candidateProposal(props.model.candidate());
          if (proposal !== null) props.model.props.onAction(proposal);
        }}
      />
      <Button
        title={t`Cancel exchange`}
        variant="ghost"
        dataSet={{ testid: `${props.model.props.testId}-exchange-cancel` }}
        onClick={() => props.model.update(toggleExchange)}
      />
    </Show>
  );
}

function EditControls(props: { model: Model; playable: boolean }): JSX.Element {
  const random = useRandom();
  return (
    <StackHorizontal gap="sm" wrap>
      <Button
        title={t`Play word`}
        disabled={
          !props.model.props.interactive ||
          !props.playable ||
          candidateProposal(props.model.candidate()) === null
        }
        dataSet={{ testid: `${props.model.props.testId}-submit` }}
        onClick={() => {
          const proposal = candidateProposal(props.model.candidate());
          if (proposal !== null) props.model.props.onAction(proposal);
        }}
      />
      <Button
        title={t`Recall tiles`}
        variant="outline"
        intent="neutral"
        disabled={props.model.candidate().placed.length === 0}
        dataSet={{ testid: `${props.model.props.testId}-recall` }}
        onClick={() => props.model.update(recallAll)}
      />
      <Button
        title={t`Undo`}
        variant="ghost"
        disabled={props.model.candidate().undo.length === 0}
        dataSet={{ testid: `${props.model.props.testId}-undo` }}
        onClick={() => props.model.update(undoEdit)}
      />
      <Button
        title={t`Redo`}
        variant="ghost"
        disabled={props.model.candidate().redo.length === 0}
        dataSet={{ testid: `${props.model.props.testId}-redo` }}
        onClick={() => props.model.update(redoEdit)}
      />
      <Button
        title={t`Shuffle rack`}
        variant="ghost"
        dataSet={{ testid: `${props.model.props.testId}-shuffle` }}
        onClick={() => props.model.update((c) => shuffleRack(c, random))}
      />
      <Button
        title={t`Pass`}
        variant="outline"
        intent="neutral"
        disabled={!props.model.props.interactive}
        dataSet={{ testid: `${props.model.props.testId}-pass` }}
        onClick={() => props.model.props.onAction('pass')}
      />
      <ExchangeControls model={props.model} />
    </StackHorizontal>
  );
}

function useBoardModel(
  board: () => GameBoardProps,
  position: () => WordTilesPosition
): Model {
  const props = board();
  const [candidate, setCandidate] = createSignal(
    newCandidate(props.position, props.hand)
  );
  // A candidate follows the position and rack it was made on; tiles that
  // are no longer possible go back, the rest stay tentative.
  createEffect(
    on([() => props.position, () => props.hand, () => props.syncKey], () =>
      setCandidate((c) => rebase(c, props.position, props.hand))
    )
  );
  return {
    props,
    position,
    candidate,
    update: (change) => setCandidate(change),
    editable: () => props.hand !== null && position().ended === null,
  };
}

/** One seat's view of a Word Tiles game: the board, their rack, and their candidate move. */
export function WordTilesBoard(props: GameBoardProps): JSX.Element {
  const position = createMemo(() => decodePosition(props.position));
  return (
    <Show
      when={position()}
      fallback={
        <P>{t`This game cannot be shown. Update the app to open it.`}</P>
      }
    >
      {(decoded) => <SeatView board={props} position={decoded} />}
    </Show>
  );
}

function SeatView(props: {
  board: GameBoardProps;
  position: () => WordTilesPosition;
}): JSX.Element {
  const m = useBoardModel(
    () => props.board,
    () => props.position()
  );
  const lexicon = useWordTilesLexicon(() => props.position().lexicon);
  const preview = createMemo(() =>
    previewCandidate(props.position(), m.candidate(), lexicon.state())
  );
  // Memoized: each square reads the list, so computing it inline would
  // rebuild the whole board once per square on every change.
  const cells = createMemo(() =>
    boardCells(props.position(), m.candidate(), m.editable())
  );
  const tiles = createMemo(() => rackTiles(m.candidate(), m.editable()));
  const testId = () => props.board.testId;
  return (
    <StackVertical gap="sm">
      <WordTilesScoreboard position={props.position()} testId={testId()} />
      <WordTileBoard
        label={t`Word board, fifteen columns and fifteen rows`}
        testId={testId()}
        columnLabels={COLUMN_LABELS}
        rowLabels={ROW_LABELS}
        cells={cells()}
        squareText={squareText}
        onActivate={(id) => {
          const cell = parseCell(id);
          if (cell !== null) m.update((c) => pressCell(c, cell));
        }}
      />
      <Show
        when={props.board.hand !== null}
        fallback={
          <P tone="secondary">{t`You are watching. Racks stay private to their players.`}</P>
        }
      >
        <TileRack
          label={t`Your rack`}
          testId={`${testId()}-rack`}
          tiles={tiles()}
          onActivate={(id) => m.update((c) => pressTile(c, Number(id)))}
        />
        <Show when={m.candidate().blankAt !== null}>
          <WordTilesBlankChooser
            testId={testId()}
            onChoose={(letter) => m.update((c) => assignBlank(c, letter))}
          />
        </Show>
        <Show when={props.position().ended === null}>
          <WordTilesPreviewPanel preview={preview()} testId={testId()} />
          <EditControls model={m} playable={preview().playable} />
        </Show>
        <Show when={lexicon.state().status === 'unavailable'}>
          <Button
            title={t`Load the word list again`}
            variant="ghost"
            dataSet={{ testid: `${testId()}-lexicon-retry` }}
            onClick={lexicon.retry}
          />
        </Show>
      </Show>
    </StackVertical>
  );
}

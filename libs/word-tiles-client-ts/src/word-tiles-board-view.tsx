import { parseCell } from '@libs/word-tiles-shared-ts/word-tiles-board';
import type { WordTilesPosition } from '@libs/word-tiles-shared-ts/word-tiles-position';
import { t } from '@lingui/core/macro';
import type { GameFrameBoardSession } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TileRack } from '@pkgs/ui-root-client-ts/tile-rack';
import { WordTileBoard } from '@pkgs/ui-root-client-ts/word-tile-board';
import { createMemo, type JSX, Show } from 'solid-js';
import type { LexiconState } from './use-word-tiles-lexicon';
import { wordTilesActions } from './word-tiles-actions';
import { assignBlank, pressCell, pressTile } from './word-tiles-candidate';
import {
  boardCells,
  COLUMN_LABELS,
  ROW_LABELS,
  rackTiles,
  squareText,
} from './word-tiles-cells';
import { createWordTilesDraft, type WordTilesDraft } from './word-tiles-draft';
import {
  WordTilesBlankChooser,
  WordTilesPreviewPanel,
} from './word-tiles-panels';

/** The board and, for a seat, its rack; a watcher is told racks stay private. */
function SeatBoard(props: {
  draft: WordTilesDraft;
  position: WordTilesPosition;
}): JSX.Element {
  // Memoized: each square reads the list, so computing it inline would
  // rebuild the whole board once per square on every change.
  const cells = createMemo(() =>
    boardCells(props.position, props.draft.candidate(), props.draft.editable())
  );
  const tiles = createMemo(() =>
    rackTiles(props.draft.candidate(), props.draft.editable())
  );
  return (
    <StackVertical gap="sm">
      <LexiconRecovery draft={props.draft} />
      <Show
        when={props.draft.props.hand !== null}
        fallback={
          <P tone="secondary">{t`You are watching. Racks stay private to their players.`}</P>
        }
      >
        <TileRack
          label={t`Your rack`}
          testId={`${props.draft.props.testId}-rack`}
          tiles={tiles()}
          onActivate={(id) =>
            props.draft.update((c) => pressTile(c, Number(id)))
          }
        />
        <StackHorizontal gap="sm" align="center" wrap>
          <DraftSubmit draft={props.draft} />
          <DraftControls draft={props.draft} />
        </StackHorizontal>
      </Show>
      <WordTileBoard
        label={t`Word board, fifteen columns and fifteen rows`}
        testId={props.draft.props.testId}
        columnLabels={COLUMN_LABELS}
        rowLabels={ROW_LABELS}
        cells={cells()}
        squareText={squareText}
        onActivate={(id) => {
          const cell = parseCell(id);
          if (cell !== null) props.draft.update((c) => pressCell(c, cell));
        }}
      />
    </StackVertical>
  );
}

function DraftBoard(props: { draft: WordTilesDraft }): JSX.Element {
  return (
    <Show
      when={props.draft.position()}
      fallback={
        <P>{t`This game cannot be shown. Update the app to open it.`}</P>
      }
    >
      {(position) => <SeatBoard draft={props.draft} position={position()} />}
    </Show>
  );
}

/**
 * Under the board, for a seat: the letter its blank plays, what the draft
 * would score (or why it cannot be played), and loading the word list again
 * when it would not load.
 */
function DraftControls(props: { draft: WordTilesDraft }): JSX.Element {
  const testId = () => props.draft.props.testId;
  return (
    <Show
      when={props.draft.props.hand !== null && props.draft.position() !== null}
    >
      <StackVertical gap="sm">
        <Show when={!props.draft.props.interactive && props.draft.editable()}>
          <P tone="secondary">{t`You can plan a word while you wait. Play it when your turn begins.`}</P>
        </Show>
        <Show when={props.draft.candidate().blankAt !== null}>
          <WordTilesBlankChooser
            testId={testId()}
            onChoose={(letter) =>
              props.draft.update((c) => assignBlank(c, letter))
            }
          />
        </Show>
        <Show when={props.draft.editable() && props.draft.preview()}>
          {(preview) => (
            <WordTilesPreviewPanel preview={preview()} testId={testId()} />
          )}
        </Show>
      </StackVertical>
    </Show>
  );
}

type WordTilesSession = Required<GameFrameBoardSession<JSX.Element>>;

/** What a seat's session reads besides its board props: its word list and shuffle. */
export type WordTilesSessionInputs = {
  readonly lexicon: WordTilesDraft['lexicon'];
  readonly random: () => number;
};

/**
 * One seat's Word Tiles session: the board with its rack, the draft move
 * both share, the draft's actions (play, recall, pass, exchange…) for the
 * frame's action bar, and its preview and blank chooser as controls.
 */
export function createWordTilesSession(
  props: GameBoardProps,
  inputs: WordTilesSessionInputs
): WordTilesSession {
  const draft = createWordTilesDraft(props, inputs.lexicon);
  return {
    Board: () => <DraftBoard draft={draft} />,
    actions: () =>
      wordTilesActions(draft, inputs.random).filter(
        (action) => action.id !== 'submit' && action.id !== 'exchange-confirm'
      ),
    controls: () => null,
  };
}

export type WordTilesBoardViewProps = GameBoardProps & {
  /** The word list the position pins: loading, ready, or unavailable. */
  readonly lexicon: LexiconState;
  readonly onRetryLexicon: () => void;
  /** Shuffles the rack. */
  readonly random: () => number;
};

/**
 * The whole Word Tiles session as one board, presentational: the board,
 * the seat's rack (or a watcher's note), the draft's preview and blank
 * chooser, and its actions. `WordTilesBoard` loads the word list and
 * supplies the shuffle.
 */
export function WordTilesBoardView(
  props: WordTilesBoardViewProps
): JSX.Element {
  const session = createWordTilesSession(props, {
    lexicon: {
      state: () => props.lexicon,
      retry: () => props.onRetryLexicon(),
    },
    random: () => props.random(),
  });
  return (
    <StackVertical gap="sm">
      <session.Board />
      <session.controls />
      <GameActionBar
        aria-label={t`Word actions`}
        items={session.actions().map((action) => ({
          id: action.id,
          label: action.label,
          testId: `${props.testId}-${action.id}`,
          onPress: action.run,
          disabled: !action.enabled,
          emphasis: action.emphasis,
        }))}
      />
    </StackVertical>
  );
}

function LexiconRecovery(props: { draft: WordTilesDraft }): JSX.Element {
  return (
    <Show when={props.draft.lexicon.state().status === 'unavailable'}>
      <P role="status">{t`The word list could not load. Your draft is kept. Reload it to preview words, or play for the game to check them.`}</P>
      <Button
        title={t`Load the word list again`}
        variant="outline"
        dataSet={{ testid: `${props.draft.props.testId}-lexicon-retry` }}
        onClick={props.draft.lexicon.retry}
      />
    </Show>
  );
}

function DraftSubmit(props: { draft: WordTilesDraft }): JSX.Element {
  const action = () =>
    wordTilesActions(props.draft, () => 0).find(
      (item) =>
        item.id ===
        (props.draft.candidate().exchange === null
          ? 'submit'
          : 'exchange-confirm')
    );
  return (
    <Show when={action()}>
      {(submit) => (
        <Button
          title={submit().label}
          disabled={!submit().enabled}
          onClick={() => submit().run()}
          dataSet={{ testid: `${props.draft.props.testId}-${submit().id}` }}
        />
      )}
    </Show>
  );
}

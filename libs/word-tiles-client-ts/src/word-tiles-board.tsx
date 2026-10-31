import { parseCell } from '@libs/word-tiles-shared-ts/word-tiles-board';
import type { WordTilesPosition } from '@libs/word-tiles-shared-ts/word-tiles-position';
import { t } from '@lingui/core/macro';
import type { GameFrameBoardSession } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TileRack } from '@pkgs/ui-root-client-ts/tile-rack';
import { WordTileBoard } from '@pkgs/ui-root-client-ts/word-tile-board';
import { useRandom } from '@pkgs/uuid-client-ts/solid';
import { createMemo, type JSX, Show } from 'solid-js';
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
      </Show>
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
        <Show when={props.draft.lexicon.state().status === 'unavailable'}>
          <Button
            title={t`Load the word list again`}
            variant="ghost"
            dataSet={{ testid: `${testId()}-lexicon-retry` }}
            onClick={props.draft.lexicon.retry}
          />
        </Show>
      </StackVertical>
    </Show>
  );
}

type WordTilesSession = Required<GameFrameBoardSession<JSX.Element>>;

/**
 * One seat's Word Tiles session: the board with its rack, the draft move
 * both share, the draft's actions (play, recall, pass, exchange…) for the
 * frame's action bar, and its preview and blank chooser as controls.
 */
export function createWordTilesBoard(props: GameBoardProps): WordTilesSession {
  const draft = createWordTilesDraft(props);
  const random = useRandom();
  return {
    Board: () => <DraftBoard draft={draft} />,
    actions: () => wordTilesActions(draft, random),
    controls: () => <DraftControls draft={draft} />,
  };
}

/**
 * The whole session as one board, for screens that show a game without
 * the frame around it (matched games, a game's history): the board, its
 * controls and its actions under them.
 */
export function WordTilesBoard(props: GameBoardProps): JSX.Element {
  const session = createWordTilesBoard(props);
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

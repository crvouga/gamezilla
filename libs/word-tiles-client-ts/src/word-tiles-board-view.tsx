import { parseCell } from '@libs/word-tiles-shared-ts/word-tiles-board';
import type { WordTilesPosition } from '@libs/word-tiles-shared-ts/word-tiles-position';
import { t } from '@lingui/core/macro';
import type { GameFrameBoardSession } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TextLink } from '@pkgs/ui-root-client-ts/text-link';
import { TileRack } from '@pkgs/ui-root-client-ts/tile-rack';
import { WordTileBoard } from '@pkgs/ui-root-client-ts/word-tile-board';
import {
  WordTileActions,
  WordTileWorkbench,
  WordTileWorkspace,
} from '@pkgs/ui-root-client-ts/word-tile-workbench';
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
  seatName,
  WordTilesBlankChooser,
  WordTilesPreviewPanel,
} from './word-tiles-panels';

/** The board and, for a seat, its rack; a watcher is told racks stay private. */
function SeatBoard(props: {
  draft: WordTilesDraft;
  position: WordTilesPosition;
  random: () => number;
}): JSX.Element {
  // Memoized: each square reads the list, so computing it inline would
  // rebuild the whole board once per square on every change.
  const cells = createMemo(() =>
    boardCells(props.position, props.draft.candidate(), props.draft.editable())
  );
  const tiles = createMemo(() =>
    rackTiles(props.draft.candidate(), props.draft.editable())
  );
  // A function, so each branch mounts its own board.
  const board = (): JSX.Element => (
    <WordTileBoard
      measure="compact"
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
  );
  return (
    <Show
      when={props.draft.props.hand !== null}
      fallback={
        <WordTileWorkspace
          notice={<LexiconRecovery draft={props.draft} />}
          rack={
            <P tone="secondary">{t`You are watching. Racks stay private to their players.`}</P>
          }
          board={board()}
        />
      }
    >
      <WordTileWorkspace
        notice={<LexiconRecovery draft={props.draft} />}
        rack={
          <TileRack
            label={t`Your rack`}
            testId={`${props.draft.props.testId}-rack`}
            tiles={tiles()}
            onActivate={(id) =>
              props.draft.update((c) => pressTile(c, Number(id)))
            }
          />
        }
        actions={
          <WordTileWorkbench>
            <LocalActions draft={props.draft} random={props.random} />
          </WordTileWorkbench>
        }
        feedback={
          <WordTileWorkbench>
            <DraftControls draft={props.draft} position={props.position} />
          </WordTileWorkbench>
        }
        board={board()}
      />
    </Show>
  );
}

function DraftBoard(props: {
  draft: WordTilesDraft;
  random: () => number;
}): JSX.Element {
  return (
    <Show
      when={props.draft.position()}
      fallback={
        <StackVertical gap="xs">
          <P>{t`This game cannot be shown by this app. Check your app version, install an available update, then reopen this game.`}</P>
          <TextLink
            href="/more/about"
            variant="standalone"
            testId={`${props.draft.props.testId}-app-info`}
          >{t`Check app version`}</TextLink>
        </StackVertical>
      }
    >
      {(position) => (
        <SeatBoard
          draft={props.draft}
          position={position()}
          random={props.random}
        />
      )}
    </Show>
  );
}

/**
 * Under the board, for a seat: the letter its blank plays, what the draft
 * would score (or why it cannot be played), and loading the word list again
 * when it would not load.
 */
function DraftControls(props: {
  draft: WordTilesDraft;
  position: WordTilesPosition;
}): JSX.Element {
  const testId = () => props.draft.props.testId;
  return (
    <Show
      when={props.draft.props.hand !== null && props.draft.position() !== null}
    >
      <StackVertical gap="xs">
        <Show when={!props.draft.props.interactive && props.draft.editable()}>
          <P tone="secondary">{t`You can plan a word while you wait. Play it when your turn begins.`}</P>
        </Show>
        <Show when={props.draft.candidate().blankAt !== null}>
          <WordTilesBlankChooser
            testId={testId()}
            cells={boardCells(props.position, props.draft.candidate(), false)}
            index={props.draft.candidate().blankAt ?? 0}
            summary={t`Scores: ${props.position.scores
              .map((score, index) => `${seatName(index)} ${score}`)
              .join(', ')}`}
            onCancel={() =>
              props.draft.update((c) =>
                c.blankAt === null ? c : pressCell(c, c.blankAt)
              )
            }
            onChoose={(letter) =>
              props.draft.update((c) => assignBlank(c, letter))
            }
          />
        </Show>
        <Show
          when={
            props.draft.editable() &&
            props.draft.candidate().blankAt === null &&
            props.draft.preview()
          }
        >
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
 * One seat's Word Tiles session: rack, draft actions, preview and blank chooser
 * stay together above the board. The frame receives no duplicate actions.
 */
export function createWordTilesSession(
  props: GameBoardProps,
  inputs: WordTilesSessionInputs
): WordTilesSession {
  const draft = createWordTilesDraft(props, inputs.lexicon);
  return {
    Board: () => <DraftBoard draft={draft} random={inputs.random} />,
    actions: () => [],
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
  return <session.Board />;
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

function LocalActions(props: {
  draft: WordTilesDraft;
  random: () => number;
}): JSX.Element {
  return (
    <WordTileActions
      label={t`Word actions`}
      moreLabel={t`More actions`}
      testId={props.draft.props.testId}
      items={wordTilesActions(props.draft, props.random)
        .filter(
          (action) =>
            action.id !== 'submit' || props.draft.candidate().exchange === null
        )
        .toSorted(
          (a, b) =>
            Number(b.emphasis === 'primary') - Number(a.emphasis === 'primary')
        )
        .map((action) => ({
          id: action.id,
          label: action.label,
          testId: `${props.draft.props.testId}-${action.id}`,
          onPress: action.run,
          disabled: !action.enabled,
          emphasis: action.emphasis,
        }))}
    />
  );
}

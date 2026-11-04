import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { t } from '@lingui/core/macro';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import {
  GameSessionHeader,
  GameSessionLayout,
} from '@pkgs/ui-root-client-ts/game-session-layout';
import { GameWatcherCount } from '@pkgs/ui-root-client-ts/game-watching';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { type JSX, Show } from 'solid-js';
import { FrameActionsView } from './game-frame-actions-view';
import {
  FrameOptionsView,
  FramePrivateSetupView,
  FrameStarterView,
  FrameStartView,
} from './game-frame-configuration-view';
import {
  FrameRecordView,
  type FrameReviewHandlers,
} from './game-frame-record-view';
import { FrameResultView } from './game-frame-result-view';
import { FrameSetupSeatsView } from './game-frame-seats-view';
import {
  FrameConnectionView,
  FrameErrorView,
  FrameFactsView,
  FramePlayNoticesView,
  FrameStatusView,
  FrameWatchingView,
  frameWatchersLabel,
} from './game-frame-status-view';
import {
  FrameNearSeatView,
  FrameOthersView,
  tableShowsTurn,
} from './game-frame-table-view';
import type {
  FrameConnection,
  FrameNext,
  FramePeople,
  FramePhase,
  FramePlay,
  FrameRecord,
  FrameResult,
  FrameSetup,
  FrameStatus,
  FrameTable,
} from './game-frame-view-types';

export type GameFrameScreenViewProps = FrameReviewHandlers & {
  readonly title: JSX.Element;
  /** Set when the person may not watch this space's games. */
  readonly denial?: DenialView | undefined;
  readonly phase: FramePhase;
  /** The viewer's own seat; `null` while watching. */
  readonly viewerSide: GameSide | null;
  readonly watchers: number;
  readonly connection: FrameConnection;
  /** A refused choice, in words; `''` for none. */
  readonly error: string;
  /** The game's own engine stopped; the saved score is kept. */
  readonly stopped: boolean;
  /** `null` with no game. */
  readonly status: FrameStatus | null;
  /** May create a game (before there is one). */
  readonly canCreate: boolean;
  readonly playerCount: number;
  /** While the game is set up. */
  readonly setup: FrameSetup | null;
  /** The seats around the board once the game is played. */
  readonly table: FrameTable;
  readonly play: FramePlay;
  /** Once the game is over. */
  readonly result: FrameResult | null;
  readonly next: FrameNext;
  readonly record: FrameRecord | null;
  /** The game's own board and its controls; the only part the game draws. */
  readonly board?: JSX.Element;
  /** The game's own private setup board, while the viewer arranges theirs. */
  readonly setupBoard?: JSX.Element;
  /** Public render state on the board stage, for automated observers. */
  readonly boardState?: Readonly<Record<string, string>> | undefined;
  readonly people?: FramePeople | undefined;
  /** Every choice about the game, as the room accepts it. */
  readonly onChoose: (input: CustomGameInput) => Promise<void>;
  readonly onReady: () => Promise<void>;
  readonly onPlayBot: () => Promise<void>;
  readonly onRandomSetup: () => Promise<void>;
  readonly onBack: () => void;
};

type Props = GameFrameScreenViewProps;

/**
 * Before a game, the starter; while one is set up, its seats and options,
 * then starting it, so Start sits right under the players it starts with.
 */
function FrameSetupSlot(props: Props): JSX.Element {
  return (
    <Show
      when={props.phase !== 'none'}
      fallback={
        <>
          <FrameStatusView status={null} />
          <FrameStarterView
            canCreate={props.canCreate}
            playerCount={props.playerCount}
            onChoose={props.onChoose}
            onPlayBot={props.onPlayBot}
          />
        </>
      }
    >
      <Show when={props.phase === 'configuring' ? props.setup : null}>
        {(setup) => (
          <>
            <FrameSetupSeatsView
              setup={setup()}
              people={props.people}
              onChoose={props.onChoose}
            />
            <Show when={setup().privateSetup}>
              {(own) => (
                <FramePrivateSetupView
                  complete={own().complete}
                  locked={own().locked}
                  board={props.setupBoard}
                  onRandom={props.onRandomSetup}
                />
              )}
            </Show>
            <Show when={setup().options}>
              {(options) => (
                <FrameOptionsView
                  options={options()}
                  onChoose={props.onChoose}
                />
              )}
            </Show>
            {/* The start line says whether the game can start. */}
            <FrameStatusView status={props.status} spokenOnly />
            <FrameStartView
              start={setup().start}
              onChoose={props.onChoose}
              onReady={props.onReady}
            />
          </>
        )}
      </Show>
    </Show>
  );
}

/**
 * Under the board: the record strip on a phone, what a player is told
 * during play, and the result once the game is over (once it is played the
 * turn line sits between the board and the person's own seat). Play
 * actions follow it, so on every screen they sit right under the board.
 */
function FrameStatusRow(props: Props): JSX.Element {
  return (
    <>
      {/* While set up without its setup in view, the line still says why. */}
      <Show when={props.phase === 'configuring' && props.setup === null}>
        <FrameStatusView status={props.status} />
      </Show>
      <FrameMoveStripSlot {...props} />
      <Show when={props.phase === 'active'}>
        <FramePlayNoticesView play={props.play} people={props.people} />
      </Show>
      <Show when={props.phase === 'completed' ? props.result : null}>
        {(result) => (
          <FrameResultView result={result()} people={props.people} />
        )}
      </Show>
    </>
  );
}

/**
 * The record has nothing to say while a game is set up: it shows once the
 * game is under way (or over), and before a game only for earlier games.
 */
function shownRecord(props: Props): FrameRecord | null {
  return props.phase === 'configuring' ? null : props.record;
}

/**
 * On a narrow screen a game played by turns keeps its record right under
 * the board, as one strip that opens to the rest of the record; a wide
 * screen keeps it in the rail beside the board.
 */
function FrameMoveStripSlot(props: Props): JSX.Element {
  const mode = useLayoutMode();
  const record = (): FrameRecord | null => {
    const shown = shownRecord(props);
    return mode() !== 'wide' &&
      (props.phase === 'active' || props.phase === 'completed') &&
      shown !== null &&
      shown.turns
      ? shown
      : null;
  };
  return (
    <Show when={record()}>
      {(shown) => (
        <FrameRecordView {...props} record={shown()} layout="strip" />
      )}
    </Show>
  );
}

/** The record's panel, unless the strip under the board already holds it. */
function FrameRecordAside(props: Props): JSX.Element {
  const mode = useLayoutMode();
  const record = (): FrameRecord | null => {
    const shown = props.phase === 'none' ? null : shownRecord(props);
    if (shown === null) return null;
    const stripped =
      mode() !== 'wide' &&
      shown.turns &&
      (props.phase === 'active' || props.phase === 'completed');
    return stripped ? null : shown;
  };
  return (
    <Show when={record()}>
      {(shown) => (
        <FrameRecordView {...props} record={shown()} layout="panel" />
      )}
    </Show>
  );
}

/** The seat to move says the plain `<Side> to move.` line itself. */
function turnInSeats(props: Props): boolean {
  return (
    props.phase === 'active' &&
    props.status?.plainTurn === true &&
    props.status.tone === 'neutral' &&
    tableShowsTurn(props.table)
  );
}

/**
 * The board and the people around it. Once the game is under way the seats
 * sit around it (the other seats above, the person's own nearest them, the
 * turn between); while it is set up the seats are in the Players section.
 */
function FrameBoardStage(props: Props): JSX.Element {
  const seated = (): boolean => props.phase !== 'configuring';
  return (
    <GameBoardStage
      dataSet={{ ...props.boardState, testid: 'custom-game-public' }}
      others={
        <Show when={seated()}>
          <FrameOthersView
            table={props.table}
            people={props.people}
            onChoose={props.onChoose}
            viewerSide={props.viewerSide}
          />
        </Show>
      }
      turn={
        <Show when={seated()}>
          <FrameStatusView
            status={props.status}
            spokenOnly={turnInSeats(props)}
          />
        </Show>
      }
      own={
        <Show when={seated()}>
          <FrameNearSeatView
            table={props.table}
            people={props.people}
            onChoose={props.onChoose}
            viewerSide={props.viewerSide}
          />
        </Show>
      }
    >
      {props.board}
      <FrameErrorView
        text={
          props.stopped
            ? t`The game stopped. Your last saved score is kept. Reopen the game to try again.`
            : ''
        }
      />
    </GameBoardStage>
  );
}

function FrameContent(props: Props): JSX.Element {
  return (
    <GameSessionLayout
      dataSet={{
        component: 'CustomGameContent',
        testid: 'custom-game-content',
      }}
      header={
        <Show when={props.phase !== 'none'}>
          <GameSessionHeader
            trailing={
              <>
                <FrameFactsView status={props.status} />
                <Show when={props.watchers > 0}>
                  <GameWatcherCount
                    value={props.watchers}
                    label={frameWatchersLabel(props.watchers)}
                    dataSet={{ testid: 'custom-game-watchers' }}
                  />
                </Show>
              </>
            }
          />
        </Show>
      }
      notices={
        <>
          <FrameConnectionView connection={props.connection} />
          <FrameErrorView text={props.error} />
        </>
      }
      setup={<FrameSetupSlot {...props} />}
      aside={<FrameRecordAside {...props} />}
      status={<FrameStatusRow {...props} />}
      actions={
        <FrameActionsView
          phase={props.phase}
          play={props.play}
          next={props.next}
          onChoose={props.onChoose}
          onBack={props.onBack}
          onSeek={props.onSeek}
        />
      }
      footer={
        <FrameWatchingView phase={props.phase} viewerSide={props.viewerSide} />
      }
    >
      <Show when={props.phase !== 'none'}>
        <FrameBoardStage {...props} />
      </Show>
    </GameSessionLayout>
  );
}

/**
 * A game's custom game in the shared game frame, presentational: before a
 * game, while it is set up (seats, private setup, options, start), while it
 * is played (the seats around the game's own board, offers, the action
 * row) and once it is over (result, rematch, review), plus the denied
 * state. The board is the game's own (`board`); everything else is plain
 * frame data. `CustomGameScreen` wires it to the space's room.
 */
export function GameFrameScreenView(props: Props): JSX.Element {
  return (
    <GameScreen screenId="custom-game" title={props.title}>
      <Show when={props.denial} fallback={<FrameContent {...props} />}>
        {(denial) => <DenialSurfaceView denial={denial()} />}
      </Show>
    </GameScreen>
  );
}

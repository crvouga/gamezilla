import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameActions } from '@pkgs/ui-root-client-ts/game-section';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { GameTableSeats } from '@pkgs/ui-root-client-ts/game-table-seat';
import { GameWatcherCount } from '@pkgs/ui-root-client-ts/game-watching';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { type JSX, Show } from 'solid-js';
import { FrameActionsView } from './game-frame-actions-view';
import {
  arenaRecordShown,
  FrameArenaRailView,
  frameArena,
} from './game-frame-arena-view';
import {
  FrameOptionsView,
  FrameOwnReadinessView,
  FramePrivateSetupView,
  FrameStarterView,
  FrameStartView,
} from './game-frame-configuration-view';
import {
  FrameHistoryLink,
  FrameRecordView,
  type FrameReviewHandlers,
  FrameReviewingView,
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
  FrameBoardSeatView,
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

/** Whether the game can start, and Start, for the setup being shown. */
function FrameStartSlot(
  props: Props & { readonly setup: FrameSetup }
): JSX.Element {
  return (
    <>
      {/* The start line says whether the game can start. */}
      <FrameStatusView status={props.status} spokenOnly />
      <FrameStartView
        start={props.setup.start}
        onChoose={props.onChoose}
        onReady={props.onReady}
      />
    </>
  );
}

/** The setup card that closes the setup, which Start is the foot of. */
function lastSetupCard(setup: FrameSetup): 'seats' | 'private' | 'options' {
  if (setup.options !== null) return 'options';
  return setup.privateSetup === null ? 'seats' : 'private';
}

/**
 * While a game is set up, its board preview is a card of its own paired
 * with the Players card, so the two read as one unit: beside it and as tall
 * as it when wide, above it on a phone, never under Start.
 */
function previewInSeats(props: Props): boolean {
  return props.phase === 'configuring' && props.setup !== null;
}

/**
 * Before a game, the starter; while one is set up, its seats and options,
 * then starting it as the foot of the last of those cards, so Start sits
 * with the players it starts with on every size (the board preview is
 * only a thumbnail inside the Players card: beside the seats when wide,
 * heading the card on a phone).
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
        {(setup) => {
          const footer = (card: ReturnType<typeof lastSetupCard>) =>
            lastSetupCard(setup()) === card ? (
              <FrameStartSlot {...props} setup={setup()} />
            ) : undefined;
          return (
            <>
              <FrameSetupSeatsView
                setup={setup()}
                people={props.people}
                onChoose={props.onChoose}
                ownReadiness={
                  <FrameOwnReadinessView
                    start={setup().start}
                    onChoose={props.onChoose}
                    onReady={props.onReady}
                  />
                }
                footer={footer('seats')}
                media={
                  <Show when={previewInSeats(props)}>
                    <FrameBoardStage {...props} />
                  </Show>
                }
              />
              <Show when={setup().privateSetup}>
                {(own) => (
                  <FramePrivateSetupView
                    complete={own().complete}
                    locked={own().locked}
                    board={props.setupBoard}
                    onRandom={props.onRandomSetup}
                    footer={footer('private')}
                  />
                )}
              </Show>
              <Show when={setup().options}>
                {(options) => (
                  <FrameOptionsView
                    options={options()}
                    onChoose={props.onChoose}
                    footer={footer('options')}
                  />
                )}
              </Show>
            </>
          );
        }}
      </Show>
    </Show>
  );
}

/**
 * Under the board on a phone, heading the rail beside a wide one: the
 * record strip on a phone, what a player is told during play, and the
 * result once the game is over (once it is played the turn line sits
 * between the board and the person's own seat). Play actions follow it, so
 * they stay in view with the board on every screen.
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
function asideRecord(
  props: Props,
  mode: ReturnType<typeof useLayoutMode>
): FrameRecord | null {
  const shown = props.phase === 'none' ? null : shownRecord(props);
  if (shown === null) return null;
  const stripped =
    mode() !== 'wide' &&
    shown.turns &&
    (props.phase === 'active' || props.phase === 'completed');
  // A game played in real time lists no moves: with no earlier game to
  // choose it has no card, only its way to the history (`FrameArenaHistory`).
  const empty = frameArena(props.phase, shown) && !arenaRecordShown(shown);
  return stripped || empty || unplayedBeside(props, mode) ? null : shown;
}

/**
 * Beside a wide board, a game played by turns whose record holds nothing
 * yet (no move, no earlier game, no refusal: Hearts while hands are
 * passed): its "Game record" card holds the game's line about what happens
 * now, the way to the history and the game's commands, so the rail is the
 * same card as every other game's and never an empty one.
 */
function unplayedBeside(
  props: Props,
  mode: ReturnType<typeof useLayoutMode>
): boolean {
  const shown = shownRecord(props);
  return (
    mode() === 'wide' &&
    shown !== null &&
    shown.turns &&
    shown.moves.length === 0 &&
    !arenaRecordShown(shown) &&
    (props.phase === 'active' || props.phase === 'completed')
  );
}

/**
 * The rail beside a board whose record holds nothing yet: the record's card,
 * its caption the game's line about what happens now.
 */
function FrameUnplayedRail(props: Props): JSX.Element {
  const mode = useLayoutMode();
  return (
    <Show when={unplayedBeside(props, mode) ? shownRecord(props) : null}>
      {(shown) => (
        <StackVertical testId="custom-game-unplayed-rail">
          <FrameRecordView
            {...props}
            record={shown()}
            layout="panel"
            caption={railCaption(props, mode)}
            commands={<FrameActions {...props} width="content" />}
          />
        </StackVertical>
      )}
    </Show>
  );
}

/**
 * Beside a wide arena (a game played in real time, once it is played) the
 * rail is the players' scoreboard, and the seats leave the stage to it.
 */
function arenaBeside(
  props: Props,
  mode: ReturnType<typeof useLayoutMode>
): boolean {
  return mode() === 'wide' && frameArena(props.phase, shownRecord(props));
}

/**
 * Beside a wide arena, or a board whose record holds no move yet, a plain
 * line about the game (the round, the serve, the pass) is the rail card's
 * caption, not a pill under the board; a warning (reconnecting, a
 * stand-in) still shows by the board.
 */
function railCaption(
  props: Props,
  mode: ReturnType<typeof useLayoutMode>
): string | undefined {
  const status = props.status;
  if (
    status === null ||
    status.tone !== 'neutral' ||
    status.sending ||
    status.description === ''
  )
    return undefined;
  return arenaBeside(props, mode) ||
    unplayedBeside(props, mode) ||
    recordCaptioned(props, mode)
    ? status.description
    : undefined;
}

/**
 * Beside a wide board during play, the game's own line about the turn
 * (`Red fleet fired at C4 and missed. Your turn to fire.`) heads the record
 * card, so the board and the seats around it fit the window's height. The
 * plain `<Side> to move.` stays with the seat that says it.
 */
function recordCaptioned(
  props: Props,
  mode: ReturnType<typeof useLayoutMode>
): boolean {
  return (
    props.phase === 'active' &&
    props.status?.plainTurn !== true &&
    asideRecord(props, mode) !== null &&
    commandsInRecord(props, mode)
  );
}

/**
 * A phone's real-time game keeps its way to the space's history in one row
 * with the play actions (Resign, then History and stats), as its record
 * has no card of its own; every other game's actions stand alone.
 */
function FramePlayActions(props: Props): JSX.Element {
  const mode = useLayoutMode();
  const history = (): FrameRecord | null => {
    const shown = shownRecord(props);
    return shown !== null &&
      !arenaBeside(props, mode) &&
      frameArena(props.phase, shown) &&
      !arenaRecordShown(shown)
      ? shown
      : null;
  };
  return (
    <Show when={history()} fallback={<FrameActions {...props} />}>
      {(shown) => (
        <GameActions>
          <FrameActions {...props} width="content" />
          <FrameHistoryLink {...props} record={shown()} quiet />
        </GameActions>
      )}
    </Show>
  );
}

/**
 * Beside a wide board the game's commands close the record's own card,
 * right under its steps, so the rail is one card as tall as what it holds.
 */
function commandsInRecord(
  props: Props,
  mode: ReturnType<typeof useLayoutMode>
): boolean {
  return (
    mode() === 'wide' &&
    (asideRecord(props, mode) !== null ||
      arenaBeside(props, mode) ||
      unplayedBeside(props, mode))
  );
}

function FrameActions(
  props: Props & { readonly width?: 'content' }
): JSX.Element {
  return (
    <FrameActionsView
      phase={props.phase}
      play={props.play}
      next={props.next}
      onChoose={props.onChoose}
      onBack={props.onBack}
      onSeek={props.onSeek}
      width={props.width}
    />
  );
}

function FrameRecordAside(props: Props): JSX.Element {
  const mode = useLayoutMode();
  return (
    <>
      <Show when={arenaBeside(props, mode) ? shownRecord(props) : null}>
        {(shown) => (
          <FrameArenaRailView
            {...props}
            record={shown()}
            caption={railCaption(props, mode)}
            commands={
              <Show when={!arenaRecordShown(shown())}>
                <FrameActions {...props} width="content" />
              </Show>
            }
          />
        )}
      </Show>
      <FrameRecordPanelAside {...props} />
      <FrameUnplayedRail {...props} />
    </>
  );
}

function FrameRecordPanelAside(props: Props): JSX.Element {
  const mode = useLayoutMode();
  return (
    <Show when={asideRecord(props, mode)}>
      {(shown) => (
        <FrameRecordView
          {...props}
          record={shown()}
          layout="panel"
          caption={railCaption(props, mode)}
          commands={
            <Show when={commandsInRecord(props, mode)}>
              <FrameActions {...props} width="content" />
            </Show>
          }
        />
      )}
    </Show>
  );
}

/** The seat to move says the plain `<Side> to move.` line itself. */
function turnInSeats(
  props: Props,
  mode: ReturnType<typeof useLayoutMode>
): boolean {
  return (
    props.phase === 'active' &&
    props.status?.plainTurn === true &&
    props.status.tone === 'neutral' &&
    tableShowsTurn(props.table, mode() !== 'wide')
  );
}

/**
 * The board and the people around it. Once the game is under way the seats
 * sit around it (the other seats above, the person's own nearest them, the
 * turn between); while it is set up the seats are in the Players section,
 * and the board is only a labelled preview beside (or under) them.
 */
function FrameBoardStage(props: Props): JSX.Element {
  const mode = useLayoutMode();
  const seated = (): boolean => props.phase !== 'configuring';
  // Beside a wide arena the seats are the rail's scoreboard instead.
  const seatsAround = (): boolean => seated() && !arenaBeside(props, mode);
  return (
    <GameBoardStage
      preview={!seated()}
      previewLabel={<Trans>Board preview</Trans>}
      dataSet={{ ...props.boardState, testid: 'custom-game-public' }}
      others={
        <Show when={seatsAround()}>
          <FrameOthersView
            table={props.table}
            people={props.people}
            onChoose={props.onChoose}
            viewerSide={props.viewerSide}
            compact={mode() !== 'wide'}
          />
        </Show>
      }
      turn={
        <Show when={seated()}>
          <FrameReviewingView
            record={shownRecord(props)}
            onReturnLive={props.onReturnLive}
          />
          <FrameStatusView
            status={props.status}
            spokenOnly={
              turnInSeats(props, mode) || railCaption(props, mode) !== undefined
            }
          />
        </Show>
      }
      own={
        <Show when={seatsAround()}>
          <FrameNearSeatView
            table={props.table}
            people={props.people}
            onChoose={props.onChoose}
            viewerSide={props.viewerSide}
            compact={mode() !== 'wide'}
          />
        </Show>
      }
    >
      <Show when={props.table.shape === 'board'} fallback={props.board}>
        <GameTableSeats
          seat={(side) => (
            <FrameBoardSeatView
              table={props.table}
              people={props.people}
              viewerSide={props.viewerSide}
              side={side}
            />
          )}
        >
          {props.board}
        </GameTableSeats>
      </Show>
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

/** On the title's line: unrated, the clock, and how many watch. */
function FrameFacts(props: Props): JSX.Element {
  return (
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
  );
}

function FrameContent(props: Props): JSX.Element {
  const mode = useLayoutMode();
  return (
    <GameSessionLayout
      dataSet={{
        component: 'CustomGameContent',
        testid: 'custom-game-content',
      }}
      notices={
        <>
          <FrameConnectionView connection={props.connection} />
          <FrameErrorView text={props.error} />
        </>
      }
      setup={<FrameSetupSlot {...props} />}
      aside={<FrameRecordAside {...props} />}
      actionsBeside
      arena={arenaBeside(props, mode)}
      boardPreview={props.phase === 'configuring'}
      status={<FrameStatusRow {...props} />}
      actions={
        <Show when={!commandsInRecord(props, mode)}>
          <FramePlayActions {...props} />
        </Show>
      }
      footer={
        <FrameWatchingView phase={props.phase} viewerSide={props.viewerSide} />
      }
    >
      <Show when={props.phase !== 'none' && !previewInSeats(props)}>
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
    <GameScreen
      screenId="custom-game"
      title={props.title}
      facts={
        <Show when={props.denial === undefined && props.phase !== 'none'}>
          <FrameFacts {...props} />
        </Show>
      }
    >
      <Show when={props.denial} fallback={<FrameContent {...props} />}>
        {(denial) => <DenialSurfaceView denial={denial()} />}
      </Show>
    </GameScreen>
  );
}

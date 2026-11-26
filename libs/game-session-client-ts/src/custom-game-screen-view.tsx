import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import type { JSX } from '@solidjs/web';
import { Match, Show, Switch } from 'solid-js';
import type { CustomGamePlace } from './custom-game-places';
import { CustomGameSetupPlace } from './custom-game-setup-view';
import { CustomGameStagePlace } from './custom-game-stage-view';
import { CustomGamesHomePlace } from './custom-games-home-view';
import {
  FrameClockPlace,
  FrameOptionsPlace,
  FramePrivateSetupPlace,
} from './game-frame-agreed-view';
import { FrameCommandsPlace } from './game-frame-commands-view';
import {
  FrameMovesPlace,
  type FrameReviewHandlers,
} from './game-frame-moves-view';
import { FrameResultPlace } from './game-frame-result-place-view';
import { FrameInvitePlace, FrameSeatPlace } from './game-frame-seat-view';
import {
  createFrameConfirm,
  FrameConfirmDialog,
  type FrameConfirmOperation,
} from './game-frame-shell';
import { withStableTable } from './game-frame-stable-table';
import type {
  FrameConnection,
  FrameNext,
  FramePeople,
  FramePhase,
  FramePlay,
  FrameRecord,
  FrameResult,
  FrameSetup,
  FrameSetupSeat,
  FrameStatus,
  FrameTable,
} from './game-frame-view-types';

/** What the room says about the game; `CustomGameScreenView` adds the place and the confirmation. */
export type GameFrameScreenData = FrameReviewHandlers & {
  readonly title: JSX.Element;
  /** How the game is won, in one sentence; absent before there is a game. */
  readonly goal?: string | undefined;
  /** Set when the person may not watch this space's games. */
  readonly denial?: DenialView | undefined;
  /** The game's stage: nobody navigates it. */
  readonly phase: FramePhase;
  /** The viewer's own seat; `null` while watching. */
  readonly viewerSide: GameSide | null;
  readonly watchers: number;
  readonly connection: FrameConnection;
  /** A refused choice, in words; `''` for none. */
  readonly error: string;
  /** The game's own engine stopped; the saved score is kept. */
  readonly stopped: boolean;
  /** Starts a stopped game again from its saved score. */
  readonly onReopen?: (() => void) | undefined;
  /** `null` with no game. */
  readonly status: FrameStatus | null;
  /** May create a game (before there is one). */
  readonly canCreate: boolean;
  readonly sides: readonly GameSide[];
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
  /** The game's square fit (`GameFrame.boardFit`); absent for width alone. */
  readonly boardFit?: 'square' | undefined;
  /** Where the board sits on one column (`GameFrame.boardAlign`); absent: centred. */
  readonly boardAlign?: 'start' | undefined;
  /**
   * The board is its own workspace (`GameFrame.boardWorkspace`): the
   * fixed view holds its box like any board's but never narrows it.
   */
  readonly boardWorkspace?: boolean | undefined;
  readonly menuMatchCommands?: boolean | undefined;
  readonly people?: FramePeople | undefined;
  /** Every choice about the game, as the room accepts it. */
  readonly onChoose: (input: CustomGameInput) => Promise<void>;
  readonly onReady: () => Promise<void>;
  readonly onPlayBot: () => Promise<void>;
  readonly onRandomSetup: () => Promise<void>;
  /** Leave the custom game for the space. */
  readonly onBack: () => void;
};

export type CustomGameScreenViewProps = GameFrameScreenData & {
  /**
   * The small screen shown, one of those the game's phase allows
   * (`CUSTOM_GAME_PLACES`). The container reconciles it with the phase;
   * a place the data cannot show falls back to the phase's home.
   */
  readonly place: CustomGamePlace;
  /** Show another of the phase's places. */
  readonly onOpen: (place: CustomGamePlace) => void;
  /** One step back, towards the phase's home. */
  readonly onClose: () => void;
};

/** What every place is given: the frame's data, and asking for its one confirmation. */
export type FramePlaceProps = CustomGameScreenViewProps & {
  /** Ask to resign or cancel: confirmed over whichever place is shown. */
  readonly onConfirm: (operation: FrameConfirmOperation) => void;
};

type Props = FramePlaceProps;

/** The seat a seat or invite place is about; `null` once it is gone. */
function placeSeat(props: Props): FrameSetupSeat | null {
  const place = props.place;
  if (place.screen !== 'seat' && place.screen !== 'invite') return null;
  return props.setup?.seats.find((seat) => seat.side === place.side) ?? null;
}

/** The places of a game being set up; the lobby when a place has nothing to show. */
function SetupPlaces(
  props: Props & { readonly setup: FrameSetup }
): JSX.Element {
  const screen = () => props.place.screen;
  return (
    <Switch fallback={<CustomGameSetupPlace {...props} />}>
      <Match when={screen() === 'seat' ? placeSeat(props) : null}>
        {(seat) => <FrameSeatPlace {...props} seat={seat()} />}
      </Match>
      <Match when={screen() === 'invite' ? placeSeat(props) : null}>
        {(seat) => <FrameInvitePlace {...props} seat={seat()} />}
      </Match>
      <Match when={screen() === 'options' ? props.setup.options : null}>
        {(options) => <FrameOptionsPlace {...props} options={options()} />}
      </Match>
      <Match when={screen() === 'clock' ? props.setup.options?.clock : null}>
        {(clock) => <FrameClockPlace {...props} clock={clock()} />}
      </Match>
      <Match
        when={screen() === 'private-setup' ? props.setup.privateSetup : null}
      >
        {(own) => <FramePrivateSetupPlace {...props} own={own()} />}
      </Match>
    </Switch>
  );
}

/** The one place the phase and the device's choice select. */
function FramePlaces(
  props: Props & { readonly confirming: boolean }
): JSX.Element {
  const screen = () => props.place.screen;
  const over = (): boolean =>
    props.phase === 'completed' || props.phase === 'cancelled';
  return (
    <Switch fallback={<CustomGamesHomePlace {...props} />}>
      <Match when={props.phase === 'configuring' ? props.setup : null}>
        {(setup) => <SetupPlaces {...props} setup={setup()} />}
      </Match>
      <Match
        when={
          screen() === 'moves' && (props.phase === 'active' || over())
            ? props.record
            : null
        }
      >
        {(record) => <FrameMovesPlace {...props} record={record()} />}
      </Match>
      <Match when={props.phase === 'active'}>
        {/* The game's menu is a sheet over the live stage. */}
        <CustomGameStagePlace {...props} />
        <Show when={screen() === 'commands'}>
          <FrameCommandsPlace {...props} />
        </Show>
      </Match>
      <Match when={over() && screen() !== 'home'}>
        <FrameResultPlace {...props} confirming={props.confirming} />
      </Match>
    </Switch>
  );
}

/**
 * A game's custom game, presentational, as one small screen at a time: the
 * place its phase and this device select (`CUSTOM_GAME_PLACES`). Before a
 * game, starting one; while it is set up, the lobby and behind its rows a
 * seat, the options, the clock and the person's private setup; while it is
 * played, the live board, the game's commands and the moves; once it is
 * over, the result. Over the places sits the frame's one confirmation,
 * which outlives the place that asked for it (resigning finishes the game,
 * which replaces the commands with the result). The board is the game's
 * own (`board`); everything else is plain frame data. `CustomGameScreen`
 * wires it to the space's room.
 */
export function CustomGameScreenView(
  props: CustomGameScreenViewProps
): JSX.Element {
  const confirm = createFrameConfirm();
  const stable = withStableTable(props);
  return (
    <>
      <Show
        when={props.denial}
        fallback={
          <FramePlaces
            {...stable}
            onConfirm={confirm.ask}
            confirming={confirm.asked() !== null}
          />
        }
      >
        {(denial) => (
          <EmbeddedScreen screenId="custom-game-denied" title={props.title}>
            <DenialSurfaceView denial={denial()} />
          </EmbeddedScreen>
        )}
      </Show>
      <FrameConfirmDialog
        confirm={confirm}
        onChoose={props.onChoose}
        beforeGame={props.phase === 'configuring'}
      />
    </>
  );
}

import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans } from '@lingui/solid/macro';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { MultiplayerCommandsView } from './multiplayer-commands-view';
import {
  type MultiplayerFindChoice,
  MultiplayerFindView,
} from './multiplayer-find-view';
import type {
  MultiplayerConfirm,
  MultiplayerGameCommands,
  MultiplayerGameView,
} from './multiplayer-game-view';
import { MultiplayerGuideView } from './multiplayer-guide-view';
import { MultiplayerMovesView } from './multiplayer-moves-view';
import { MultiplayerNotices } from './multiplayer-notices';
import type { MultiplayerPlaceFrame } from './multiplayer-place-frame';
import type { MultiplayerPlace, MultiplayerStage } from './multiplayer-places';
import { MultiplayerPlayView } from './multiplayer-play-view';
import { MultiplayerPrivateSetupView } from './multiplayer-private-setup-view';
import type { MultiplayerRatingView } from './multiplayer-ratings';
import { MultiplayerRatingsView } from './multiplayer-ratings-view';
import { MultiplayerResultView } from './multiplayer-result-view';
import { MultiplayerSearchingView } from './multiplayer-searching-view';
import { MultiplayerStatusView } from './multiplayer-status-view';
import { MultiplayerTimeControlView } from './multiplayer-time-control-view';
import type { MultiplayerSearchView } from './multiplayer-waiting';

export type MultiplayerScreenViewProps = {
  readonly title: string;
  /** Where the search and the game stand; see `multiplayerStageOf`. */
  readonly stage: MultiplayerStage;
  /** The small screen this device shows within the stage. */
  readonly place: MultiplayerPlace;
  /** Shows another of the stage's places. */
  readonly onOpen: (place: MultiplayerPlace) => void;
  /** One step back within the stage: to the place behind this one. */
  readonly onBack: () => void;
  /** Leaves finding an opponent for the game's choices. */
  readonly onLeave: () => void;
  /** Set in the `denied` stage: why, and the way forward. */
  readonly denial?: DenialView | undefined;
  /** A command the person may not give, such as finishing their current game first. */
  readonly commandDenial?: DenialView | undefined;
  /** A refused command, in words. */
  readonly error: string | null;
  readonly online: boolean;
  /** What a new search is for, at the time control this device chose. */
  readonly find: MultiplayerFindChoice;
  readonly onChooseTimeControl: (timeControl: string) => void;
  /** Starts a search, at the chosen time control when the game is timed. */
  readonly onFind: (timeControl: string | undefined) => Promise<void>;
  /** The search under way; set in the `searching` stage. */
  readonly search: MultiplayerSearchView | null;
  readonly onStop: () => Promise<void>;
  readonly ratings: readonly MultiplayerRatingView[];
  /** The matched game; set in the `setup`, `playing` and `finished` stages. */
  readonly game: MultiplayerGameView | null;
  readonly commands: MultiplayerGameCommands;
  /** The matched game's seats, its board and the line that says where it stands. */
  readonly board?: JSX.Element;
  /** The person's own private setup for the matched game. */
  readonly setup?: JSX.Element;
  /** How the matched game ended, as the result's headline. */
  readonly outcome?: JSX.Element;
  /** The confirmation open now, if any. */
  readonly confirming: MultiplayerConfirm | null;
  /** The game seats more than two: resigning draws the round for everyone. */
  readonly manyPlayers: boolean;
  /** Carries out the confirmed command. */
  readonly onConfirm: () => Promise<void>;
  readonly onCloseConfirm: () => void;
};

type Props = MultiplayerScreenViewProps;

/**
 * Resigning and aborting ask first. The dialog is the shell's, so it stays
 * through the game ending under it and the result taking the screen.
 */
function ConfirmModal(props: Props): JSX.Element {
  return (
    <MutationModal
      visible={props.confirming !== null}
      onClose={() => props.onCloseConfirm()}
      title={
        <Show
          when={props.confirming === 'abort'}
          fallback={<Trans>Resign multiplayer game?</Trans>}
        >
          <Trans>Abort the multiplayer game?</Trans>
        </Show>
      }
      message={
        <Switch fallback={<Trans>Your opponent will win this game.</Trans>}>
          <Match when={props.confirming === 'abort'}>
            <Trans>The game ends with no result and no rating change.</Trans>
          </Match>
          <Match when={props.manyPlayers}>
            <Trans>The round will end in a draw for all players.</Trans>
          </Match>
        </Switch>
      }
      operation={() => props.onConfirm()}
      submitLabel={<Trans>Confirm</Trans>}
      successTitle={<Trans>Multiplayer command accepted</Trans>}
      variant="destructive"
      submitDataSet={{ testid: 'multiplayer-confirm' }}
      dismissDataSet={{ testid: 'multiplayer-dismiss' }}
    />
  );
}

/** What the shell gives every place: where it stands and the notices. */
function frameOf(props: Props): MultiplayerPlaceFrame {
  return {
    get stage() {
      return props.stage;
    },
    get place() {
      return props.place;
    },
    get notices() {
      return (
        <MultiplayerNotices
          denial={props.commandDenial}
          error={props.error}
          online={props.online}
        />
      );
    },
  };
}

/** Why there is nothing to do, and what to do about it. */
function StatusPlace(props: Props): JSX.Element {
  return (
    <MultiplayerStatusView
      {...frameOf(props)}
      title={props.title}
      denial={props.denial}
      onLeave={props.onLeave}
    />
  );
}

/** The search's hub. */
function FindPlace(props: Props): JSX.Element {
  return (
    <MultiplayerFindView
      {...frameOf(props)}
      title={props.title}
      find={props.find}
      ratings={props.ratings}
      onOpen={props.onOpen}
      onFind={props.onFind}
    />
  );
}

/** Choosing the clock returns to the hub with it. */
function TimeControlPlace(props: Props): JSX.Element {
  return (
    <MultiplayerTimeControlView
      {...frameOf(props)}
      timeControl={props.find.timeControl}
      onChoose={(timeControl) => {
        props.onChooseTimeControl(timeControl);
        props.onBack();
      }}
    />
  );
}

/** The wait, while there is a search. */
function SearchingPlace(props: Props): JSX.Element {
  return (
    <Show when={props.search}>
      {(search) => (
        <MultiplayerSearchingView
          {...frameOf(props)}
          title={props.title}
          search={search()}
          onStop={props.onStop}
        />
      )}
    </Show>
  );
}

/** The matched game's private setups, while it waits for them. */
function PrivateSetupPlace(props: Props): JSX.Element {
  return (
    <Show when={props.game}>
      {(game) => (
        <MultiplayerPrivateSetupView
          {...frameOf(props)}
          title={props.title}
          setup={props.setup}
          board={props.board}
          game={game()}
          onOpen={props.onOpen}
        />
      )}
    </Show>
  );
}

/** The matched game in play. */
function PlayPlace(props: Props): JSX.Element {
  return (
    <Show when={props.game}>
      {(game) => (
        <MultiplayerPlayView
          {...frameOf(props)}
          title={props.title}
          board={props.board}
          game={game()}
          commands={props.commands}
          onOpen={props.onOpen}
        />
      )}
    </Show>
  );
}

/** The matched game's commands. */
function CommandsPlace(props: Props): JSX.Element {
  return (
    <Show when={props.game}>
      {(game) => (
        <MultiplayerCommandsView
          {...frameOf(props)}
          game={game()}
          commands={props.commands}
          onOpen={props.onOpen}
          onBack={props.onBack}
        />
      )}
    </Show>
  );
}

/** The matched game's moves. */
function MovesPlace(props: Props): JSX.Element {
  return (
    <Show when={props.game}>
      {(game) => (
        <MultiplayerMovesView
          {...frameOf(props)}
          title={props.title}
          board={props.board}
          game={game()}
          commands={props.commands}
        />
      )}
    </Show>
  );
}

/** The matched game's result. */
function ResultPlace(props: Props): JSX.Element {
  return (
    <Show when={props.game}>
      {(game) => (
        <MultiplayerResultView
          {...frameOf(props)}
          title={props.title}
          outcome={props.outcome}
          board={props.board}
          game={game()}
          commands={props.commands}
          online={props.online}
          onOpen={props.onOpen}
        />
      )}
    </Show>
  );
}

/** The one switch: the place shown, each a small screen of its own. */
function Places(props: Props): JSX.Element {
  return (
    <Switch>
      <Match when={props.place.screen === 'status'}>
        <StatusPlace {...props} />
      </Match>
      <Match when={props.place.screen === 'find'}>
        <FindPlace {...props} />
      </Match>
      <Match when={props.place.screen === 'time-control'}>
        <TimeControlPlace {...props} />
      </Match>
      <Match when={props.place.screen === 'ratings'}>
        <MultiplayerRatingsView {...frameOf(props)} ratings={props.ratings} />
      </Match>
      <Match when={props.place.screen === 'guide'}>
        <MultiplayerGuideView {...frameOf(props)} />
      </Match>
      <Match when={props.place.screen === 'searching'}>
        <SearchingPlace {...props} />
      </Match>
      <Match when={props.place.screen === 'private-setup'}>
        <PrivateSetupPlace {...props} />
      </Match>
      <Match when={props.place.screen === 'play'}>
        <PlayPlace {...props} />
      </Match>
      <Match when={props.place.screen === 'commands'}>
        <CommandsPlace {...props} />
      </Match>
      <Match when={props.place.screen === 'moves'}>
        <MovesPlace {...props} />
      </Match>
      <Match when={props.place.screen === 'result'}>
        <ResultPlace {...props} />
      </Match>
    </Switch>
  );
}

/**
 * Finding an opponent for a game and playing the matched game,
 * presentational: one small screen at a time, chosen by the `stage` the
 * search and the game stand in and the `place` this device opened within
 * it (`MULTIPLAYER_PLACES`). Before a game: why there is nothing to do,
 * the search's hub with its clock, ratings and guide one row away, and the
 * wait. With a game: its private setup, play on the live position, its
 * commands, its moves and its result. The connection and refusal notices
 * show on every place, and the resign and abort confirmation belongs to
 * this shell, so both outlive the place under them. The board, the private
 * setup and the result's headline are slots; `MultiplayerScreen` wires it
 * all to matchmaking.
 */
export function MultiplayerScreenView(props: Props): JSX.Element {
  return (
    <>
      <Places {...props} />
      <ConfirmModal {...props} />
    </>
  );
}

import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans } from '@lingui/solid/macro';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { MultiplayerFindPanel } from './multiplayer-find-panel';
import { MultiplayerNotices } from './multiplayer-notices';
import {
  MultiplayerRatings,
  type MultiplayerRatingView,
} from './multiplayer-ratings';
import {
  type MultiplayerSearchView,
  MultiplayerWaiting,
} from './multiplayer-waiting';

/**
 * What the stage shows: still reading, nothing available, only a search
 * (no game yet), or a game.
 */
export type MultiplayerStage = 'loading' | 'unavailable' | 'search' | 'game';

/** What comes after a game, or before the first. A watcher is offered neither. */
export type MultiplayerNext =
  | { readonly kind: 'none' }
  | { readonly kind: 'searching'; readonly search: MultiplayerSearchView }
  | {
      readonly kind: 'find';
      readonly players: number;
      readonly timed: boolean;
    };

/** The command waiting for the person to confirm. */
export type MultiplayerConfirm = 'resign' | 'abort';

export type MultiplayerScreenViewProps = {
  readonly title: string;
  /** Set when the person may not see this game or search. */
  readonly denial?: DenialView | undefined;
  readonly stage: MultiplayerStage;
  readonly next: MultiplayerNext;
  /** A command the person may not give, such as finishing their current game first. */
  readonly commandDenial?: DenialView | undefined;
  /** A refused command, in words. */
  readonly error: string | null;
  readonly online: boolean;
  readonly ratings: readonly MultiplayerRatingView[];
  /** The confirmation open now, if any. */
  readonly confirming: MultiplayerConfirm | null;
  /** The game seats more than two: resigning draws the round for everyone. */
  readonly manyPlayers: boolean;
  /** The matched game's board, seats and status line. */
  readonly board?: JSX.Element;
  /** The person's own private setup for the matched game. */
  readonly setupPanel?: JSX.Element;
  /** The matched game's commands (draws, rematch, resign, abort). */
  readonly gameActions?: JSX.Element;
  /** The matched game's moves, beside the board. */
  readonly moves?: JSX.Element;
  /** Starts a search, at the chosen time control when the game is timed. */
  readonly onFind: (timeControl: string | undefined) => Promise<void>;
  readonly onStop: () => Promise<void>;
  /** Carries out the confirmed command. */
  readonly onConfirm: () => Promise<void>;
  readonly onCloseConfirm: () => void;
};

type Props = MultiplayerScreenViewProps;

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

/** The search under way, or the choice of a time control for a new one. */
function NextGame(props: Props): JSX.Element {
  return (
    <Switch>
      <Match when={props.next.kind === 'searching' ? props.next : null}>
        {(next) => (
          <MultiplayerWaiting search={next().search} onStop={props.onStop} />
        )}
      </Match>
      <Match when={props.next.kind === 'find' ? props.next : null}>
        {(next) => (
          <MultiplayerFindPanel
            players={next().players}
            timed={next().timed}
            onFind={props.onFind}
          />
        )}
      </Match>
    </Switch>
  );
}

/** The board when there is a game, then what the person can do next. */
function Stage(props: Props): JSX.Element {
  return (
    <>
      <Show when={props.stage === 'game'}>
        {props.setupPanel}
        {props.board}
      </Show>
      <Show when={props.stage === 'loading' || props.stage === 'unavailable'}>
        <Show
          when={props.stage === 'unavailable'}
          fallback={
            <LoadingState
              variant="compact"
              caption={<Trans>Loading the game…</Trans>}
              dataSet={{ testid: 'multiplayer-loading' }}
            />
          }
        >
          <Notice dataSet={{ testid: 'multiplayer-unavailable' }}>
            <Text variant="inherit" role="status">
              <Trans>No multiplayer game is available to you.</Trans>
            </Text>
          </Notice>
        </Show>
      </Show>
      <Show when={props.stage === 'game'}>{props.gameActions}</Show>
      <NextGame {...props} />
      {/* With no board, the ratings follow the search in the one column,
          at its width, rather than a rail beside an empty board. */}
      <Show when={props.stage !== 'game'}>
        <MultiplayerRatings ratings={props.ratings} />
      </Show>
      <ConfirmModal {...props} />
    </>
  );
}

/**
 * Finding an opponent for a game, presentational: searching, the matched
 * game (its board, seats and commands are slots), the time-control choice
 * for a new game, refusals (finishing the current game first, a refused
 * command, offline), confirmations and the person's ratings, plus the
 * denied state. `MultiplayerScreen` wires it to matchmaking.
 */
export function MultiplayerScreenView(props: Props): JSX.Element {
  return (
    <GameScreen screenId="multiplayer" title={props.title}>
      <Show
        when={props.denial}
        fallback={
          <GameSessionLayout
            notices={
              <MultiplayerNotices
                denial={props.commandDenial}
                error={props.error}
                online={props.online}
              />
            }
            aside={
              <Show when={props.stage === 'game'}>
                {props.moves}
                <MultiplayerRatings ratings={props.ratings} />
              </Show>
            }
          >
            <Stage {...props} />
          </GameSessionLayout>
        }
      >
        {(denial) => <DenialSurfaceView denial={denial()} />}
      </Show>
    </GameScreen>
  );
}

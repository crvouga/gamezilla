import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import {
  bothHaveMoved,
  otherPerson,
} from '@libs/game-matchmaking-shared/game-state';
import { multiplayerDeadlineMs } from '@libs/game-matchmaking-shared/multiplayer-clock';
import { isDailyTimeControl } from '@libs/game-matchmaking-shared/time-control';
import { Trans } from '@lingui/solid/macro';
import { useGamePresentation } from '@pkgs/turn-game-client/turn-games-context';
import { useGameSideLabel } from '@pkgs/turn-game-client/use-game-side-label';
import { Badge } from '@pkgs/ui-root-client/badge';
import { GameCountdown } from '@pkgs/ui-root-client/game-countdown';
import type { GameStatusTone } from '@pkgs/ui-root-client/game-status';
import { GameStatus } from '@pkgs/ui-root-client/game-status';
import { VisuallyHidden } from '@pkgs/ui-root-client/visually-hidden';
import { type JSX, Match, Show, Switch } from 'solid-js';
import type { MultiplayerViewer } from './multiplayer-seat';
import { timeLeftWords } from './multiplayer-time-left';
import { timeControlText } from './time-control-name';
import type { LowOnTime } from './use-low-on-time';
import { useOfflineSince } from './use-offline-since';

type StatusProps = {
  readonly game: MultiplayerGame;
  readonly viewer: MultiplayerViewer;
  /** The winner's name, for a watcher. */
  readonly winnerName: string;
  /** The clock that is low on time, if one is. */
  readonly lowOnTime: LowOnTime | null;
};

const white = (props: StatusProps): boolean =>
  props.game.white_id === props.viewer.myId;

/** How a finished game reads to a person who played it. */
function PlayerResult(props: StatusProps): JSX.Element {
  const won = () => (props.game.outcome === 'white') === white(props);
  return (
    <Switch>
      <Match when={props.game.outcome === 'aborted'}>
        <Trans>The multiplayer game was aborted.</Trans>
      </Match>
      <Match when={props.game.outcome === 'draw'}>
        <Trans>The multiplayer game is drawn.</Trans>
      </Match>
      <Match when={won()}>
        <Trans>You won the multiplayer game.</Trans>
      </Match>
      <Match when={!won()}>
        <Trans>Your opponent won the multiplayer game.</Trans>
      </Match>
    </Switch>
  );
}

/**
 * A playing person's headline. The match details are for a listener, who
 * cannot see the seats; the eye gets only whose turn it is.
 */
function PlayerHeadline(props: StatusProps): JSX.Element {
  const gameSideLabel = useGameSideLabel();
  return (
    <Show
      when={props.game.outcome === 'ongoing'}
      fallback={<PlayerResult {...props} />}
    >
      <VisuallyHidden>
        <Trans>
          Matched with {props.viewer.opponentName}, rated{' '}
          {props.viewer.opponentRating}, at{' '}
          {timeControlText(props.game.time_control)}.
        </Trans>{' '}
        <Trans>
          You are{' '}
          {gameSideLabel(props.game.fen, white(props) ? 'white' : 'black')}.
        </Trans>{' '}
      </VisuallyHidden>
      <Show
        when={props.game.turn === props.viewer.myId}
        fallback={<Trans>Your opponent's turn.</Trans>}
      >
        <Trans>Your turn.</Trans>
      </Show>
    </Show>
  );
}

function WatcherHeadline(props: StatusProps): JSX.Element {
  return (
    <>
      <Trans>Watching this game.</Trans>
      <Show
        when={props.game.outcome === 'white' || props.game.outcome === 'black'}
      >
        {' '}
        <Trans>{props.winnerName} won the multiplayer game.</Trans>
      </Show>
      <Show when={props.game.outcome === 'draw'}>
        {' '}
        <Trans>The multiplayer game is drawn.</Trans>
      </Show>
    </>
  );
}

/**
 * For a listener, who cannot see the clocks: whose clock is low on time and
 * what it had left when it became so. Said once, not as the clock ticks.
 */
function LowOnTimeWords(props: StatusProps): JSX.Element {
  const gameSideLabel = useGameSideLabel();
  return (
    <Show when={props.lowOnTime}>
      {(low) => (
        <VisuallyHidden>
          {' '}
          <Show
            when={low().side === 'white'}
            fallback={
              <Trans>
                {gameSideLabel(props.game.fen, 'black')} is low on time, with{' '}
                {timeLeftWords(low().leftMs)} left.
              </Trans>
            }
          >
            <Trans>
              {gameSideLabel(props.game.fen, 'white')} is low on time, with{' '}
              {timeLeftWords(low().leftMs)} left.
            </Trans>
          </Show>
        </VisuallyHidden>
      )}
    </Show>
  );
}

/** Why a finished game ended, in the person's words. */
function Reason(props: { readonly game: MultiplayerGame }): JSX.Element {
  const gameSideLabel = useGameSideLabel();
  const presentation = useGamePresentation();
  const flagged = () =>
    gameSideLabel(
      props.game.fen,
      props.game.white_ms === 0 ? 'white' : 'black'
    );
  return (
    <Switch>
      <Match when={props.game.reason === 'resignation'}>
        <Trans>By resignation.</Trans>
      </Match>
      <Match when={props.game.reason === 'timeout'}>
        <Trans>{flagged()} ran out of time.</Trans>
      </Match>
      <Match when={props.game.reason === 'timeout vs insufficient material'}>
        {presentation(props.game.fen).timeoutDrawDescription(
          props.game.white_ms === 0 ? 'white' : 'black'
        )}
      </Match>
      <Match when={props.game.reason === 'agreement'}>
        <Trans>Drawn by agreement.</Trans>
      </Match>
      <Match when={props.game.reason === 'first move missed'}>
        <Trans>The first move wasn't made in time.</Trans>
      </Match>
      <Match when={props.game.reason === 'account deletion'}>
        <Trans>An account was deleted.</Trans>
      </Match>
      <Match when={props.game.reason !== null}>
        {presentation(props.game.fen).endingDescription(
          props.game.reason ?? ''
        )}
      </Match>
    </Switch>
  );
}

/** A draw the position itself made. */

function RatingChange(props: StatusProps): JSX.Element {
  const diff = () =>
    white(props) ? props.game.white_rating_diff : props.game.black_rating_diff;
  return (
    <Show when={props.viewer.participant && diff() !== null}>
      <span data-testid="multiplayer-rating-change">
        <Trans>
          Your rating changed by {(diff() ?? 0) > 0 ? '+' : ''}
          {diff() ?? 0}.
        </Trans>
      </span>
    </Show>
  );
}

function Offers(props: StatusProps): JSX.Element {
  const offeredToMe = (by: string | null) =>
    props.viewer.participant &&
    by === otherPerson(props.game, props.viewer.myId);
  return (
    <>
      <Show when={offeredToMe(props.game.draw_offer_by)}>
        <Trans>
          {props.viewer.opponentName} offered you a multiplayer draw.
        </Trans>{' '}
      </Show>
      <Show when={offeredToMe(props.game.rematch_offer_by)}>
        <Trans>
          {props.viewer.opponentName} offered you a multiplayer rematch.
        </Trans>{' '}
      </Show>
    </>
  );
}

function StatusDetail(props: StatusProps): JSX.Element {
  return (
    <>
      <Show when={props.game.outcome !== 'ongoing'}>
        <Reason game={props.game} />{' '}
      </Show>
      <Offers {...props} />
      <RatingChange {...props} />
    </>
  );
}

function hasDetail(props: StatusProps): boolean {
  const game = props.game;
  if (game.outcome !== 'ongoing' && game.reason !== 'abort') return true;
  if (!props.viewer.participant) return false;
  const other = otherPerson(game, props.viewer.myId);
  return (
    game.draw_offer_by === other ||
    game.rematch_offer_by === other ||
    (white(props) ? game.white_rating_diff : game.black_rating_diff) !== null
  );
}

/** The person's own clock is the one that is low on time. */
const ownClockLow = (props: StatusProps): boolean =>
  props.lowOnTime !== null &&
  props.viewer.participant &&
  (props.lowOnTime.side === 'white') === white(props);

function tone(props: StatusProps): GameStatusTone {
  const game = props.game;
  if (ownClockLow(props)) return 'warning';
  if (game.outcome === 'ongoing')
    return game.turn === props.viewer.myId ? 'active' : 'neutral';
  const won =
    props.viewer.participant && (game.outcome === 'white') === white(props);
  return won && game.outcome !== 'draw' && game.outcome !== 'aborted'
    ? 'success'
    : 'neutral';
}

/** The first-move deadline, while one of the two has yet to move. */
function FirstMoveCountdown(props: StatusProps): JSX.Element {
  const offlineSince = useOfflineSince();
  return (
    <GameCountdown
      deadline={multiplayerDeadlineMs(props.game)}
      pausedAt={offlineSince()}
      label={
        <Show
          when={props.game.turn === props.viewer.myId}
          fallback={<Trans>Waiting for the first move</Trans>}
        >
          <Trans>Make your first move</Trans>
        </Show>
      }
      dataSet={{ testid: 'multiplayer-first-move-countdown' }}
    />
  );
}

/** A daily game's first move is timed by its own clock, in days. */
const awaitingFirstMoves = (props: StatusProps): boolean =>
  props.game.outcome === 'ongoing' &&
  props.game.paused_at_ms === null &&
  !bothHaveMoved(props.game) &&
  !isDailyTimeControl(props.game.time_control);

/**
 * Where the game stands, in one line under the board: whose turn, or how it
 * ended and why. It is the screen's live announcement, so a listener hears
 * colour, turn, offers and the result as they change.
 */
export function MultiplayerStatus(props: StatusProps): JSX.Element {
  return (
    <GameStatus
      live
      tone={tone(props)}
      dataSet={{ testid: 'multiplayer-announcement' }}
      title={
        <>
          <Show
            when={
              props.game.outcome === 'ongoing' &&
              props.game.paused_at_ms !== null
            }
          >
            <span data-testid="multiplayer-paused">
              <Trans>Multiplayer clocks are paused.</Trans>{' '}
            </span>
          </Show>
          <Show
            when={props.viewer.participant}
            fallback={<WatcherHeadline {...props} />}
          >
            <PlayerHeadline {...props} />
          </Show>
          <LowOnTimeWords {...props} />
        </>
      }
      detail={hasDetail(props) ? <StatusDetail {...props} /> : undefined}
      note={
        awaitingFirstMoves(props) ? (
          <FirstMoveCountdown {...props} />
        ) : undefined
      }
      trailing={
        <Badge
          intent="neutral"
          label={
            <span data-testid="multiplayer-time-control">
              {timeControlText(props.game.time_control)}
            </span>
          }
        />
      }
    />
  );
}

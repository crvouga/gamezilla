import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import {
  awaitingSetups,
  bothHaveMoved,
} from '@libs/game-matchmaking-shared-ts/game-state';
import { multiplayerDeadlineMs } from '@libs/game-matchmaking-shared-ts/multiplayer-clock';
import {
  MULTIPLAYER_SIDES,
  multiplayerOwner,
  multiplayerSideOf,
  multiplayerSides,
} from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import {
  isDailyTimeControl,
  timeControlOf,
} from '@libs/game-matchmaking-shared-ts/time-control';
import { Trans } from '@lingui/solid/macro';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { useGameSideLabel } from '@pkgs/turn-game-client-ts/use-game-side-label';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { GameCountdown } from '@pkgs/ui-root-client-ts/game-countdown';
import type {
  GameTurnPillEmphasis,
  GameTurnPillTone,
} from '@pkgs/ui-root-client-ts/game-turn-pill';
import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { type JSX, Match, Show, Switch } from 'solid-js';
import type { MultiplayerViewer } from './multiplayer-seat';
import { timeLeftWords } from './multiplayer-time-left';
import { timeControlText } from './time-control-name';
import type { LowOnTime } from './use-low-on-time';
import { useOfflineSince } from './use-offline-since';
import { useShownName } from './use-shown-name';

/** What the announcement is made from. */
export type MultiplayerStatusProps = {
  readonly game: MultiplayerGame;
  readonly viewer: MultiplayerViewer;
  /** The winner's name, for a watcher or another participant. */
  readonly winnerName: string;
  /** The clock that is low on time, if one is. */
  readonly lowOnTime: LowOnTime | null;
};

type StatusProps = MultiplayerStatusProps;

const ownSide = (props: StatusProps) =>
  multiplayerSideOf(props.game, props.viewer.myId) ?? 'white';

/** Game-specific live words; setup and match results keep their own headline. */
function useFrameTurnStatus(props: StatusProps): () => string | null {
  const presentation = useGamePresentation();
  const names = new Map(
    MULTIPLAYER_SIDES.map((side) => [
      side,
      useShownName(() => multiplayerOwner(props.game, side)),
    ])
  );
  return () =>
    props.game.outcome === 'ongoing' && !awaitingSetups(props.game)
      ? presentation(props.game.fen).frame.turnStatus(
          props.game.fen,
          multiplayerSideOf(props.game, props.viewer.myId),
          [],
          (side) =>
            multiplayerOwner(props.game, side)
              ? (names.get(side)?.() ?? null)
              : null
        )
      : null;
}

/** How a finished game reads to a person who played it. */
function PlayerResult(props: StatusProps): JSX.Element {
  const won = () => props.game.outcome === ownSide(props);
  return (
    <Switch>
      <Match when={props.game.outcome === 'aborted'}>
        <Trans>
          The <VisuallyHidden>multiplayer </VisuallyHidden>game was aborted.
        </Trans>
      </Match>
      <Match when={props.game.outcome === 'draw'}>
        <Trans>
          The <VisuallyHidden>multiplayer </VisuallyHidden>game is drawn.
        </Trans>
      </Match>
      <Match when={won()}>
        <Trans>
          You won<VisuallyHidden> the multiplayer game</VisuallyHidden>.
        </Trans>
      </Match>
      <Match when={multiplayerSides(props.game).length > 2}>
        <Trans>
          {props.winnerName} won
          <VisuallyHidden> the multiplayer game</VisuallyHidden>.
        </Trans>
      </Match>
      <Match when={!won()}>
        <Trans>
          Your opponent won
          <VisuallyHidden> the multiplayer game</VisuallyHidden>.
        </Trans>
      </Match>
    </Switch>
  );
}

/**
 * A playing person's headline. The match details are for a listener, who
 * cannot see the seats; the visible line uses the game's turn instructions.
 */
function PlayerHeadline(props: StatusProps): JSX.Element {
  const gameSideLabel = useGameSideLabel();
  const turnStatus = useFrameTurnStatus(props);
  const turnName = useShownName(() => props.game.turn);
  const count = () => multiplayerSides(props.game).length;
  const timed = () => timeControlOf(props.game.time_control) !== null;
  return (
    <Show
      when={props.game.outcome === 'ongoing'}
      fallback={<PlayerResult {...props} />}
    >
      <VisuallyHidden>
        <Show
          when={count() > 2}
          fallback={
            <>
              <Trans>
                Matched with {props.viewer.opponentName}, rated{' '}
                {props.viewer.opponentRating}.
              </Trans>{' '}
              <Show when={timed()}>
                <Trans>
                  Time control: {timeControlText(props.game.time_control)}.
                </Trans>{' '}
              </Show>
            </>
          }
        >
          <Show
            when={timed()}
            fallback={<Trans>A multiplayer game for {count()} players.</Trans>}
          >
            <Trans>
              A multiplayer game for {count()} players at{' '}
              {timeControlText(props.game.time_control)}.
            </Trans>
          </Show>{' '}
        </Show>
        <Trans>You are {gameSideLabel(props.game.fen, ownSide(props))}.</Trans>{' '}
        <Show when={count() === 2 && props.game.turn !== '' && turnStatus()}>
          <Show
            when={props.game.turn === props.viewer.myId}
            fallback={<Trans>Your opponent's turn.</Trans>}
          >
            <Trans>Your turn.</Trans>
          </Show>{' '}
        </Show>
        <Show when={count() > 2 && props.game.turn !== '' && turnStatus()}>
          <Trans>{turnName()}'s turn.</Trans>{' '}
        </Show>
      </VisuallyHidden>
      <Show
        when={turnStatus()}
        fallback={
          <Show
            when={props.game.turn !== ''}
            fallback={<Trans>Game in progress.</Trans>}
          >
            <Show
              when={props.game.turn === props.viewer.myId}
              fallback={
                <Show
                  when={count() > 2}
                  fallback={<Trans>Your opponent's turn.</Trans>}
                >
                  <Trans>{turnName()}'s turn.</Trans>
                </Show>
              }
            >
              <Trans>Your turn.</Trans>
            </Show>
          </Show>
        }
      >
        {(status) => <>{status()}</>}
      </Show>
    </Show>
  );
}

function WatcherHeadline(props: StatusProps): JSX.Element {
  const turnStatus = useFrameTurnStatus(props);
  const presentation = useGamePresentation();
  const turnName = useShownName(() => props.game.turn);
  return (
    <>
      <Trans>Watching multiplayer {presentation(props.game.fen).name()}.</Trans>
      <Show
        when={turnStatus()}
        fallback={
          <Show
            when={
              props.game.outcome === 'ongoing' &&
              multiplayerSides(props.game).length > 2
            }
          >
            {' '}
            <Trans>{turnName()}'s turn.</Trans>
          </Show>
        }
      >
        {(status) => (
          <>
            <Show
              when={
                multiplayerSides(props.game).length > 2 &&
                props.game.turn !== ''
              }
            >
              <VisuallyHidden>
                {' '}
                <Trans>{turnName()}'s turn.</Trans>
              </VisuallyHidden>
            </Show>{' '}
            {status()}
          </>
        )}
      </Show>
      <Show
        when={multiplayerSides(props.game).includes(
          props.game.outcome as ReturnType<typeof ownSide>
        )}
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
          <Trans>
            {gameSideLabel(props.game.fen, low().side)} is low on time, with{' '}
            {timeLeftWords(low().leftMs)} left.
          </Trans>
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
      multiplayerSides(props.game).find(
        (side) => props.game[`${side}_ms`] === 0
      ) ?? 'white'
    );
  return (
    <Switch>
      <Match when={props.game.reason === 'participant withdrew'}>
        <Trans>A player left the round.</Trans>
      </Match>
      <Match when={props.game.reason === 'resignation'}>
        <Trans>By resignation.</Trans>
      </Match>
      <Match when={props.game.reason === 'timeout'}>
        <Trans>{flagged()} ran out of time.</Trans>
      </Match>
      <Match when={props.game.reason === 'timeout vs insufficient material'}>
        {presentation(props.game.fen).timeoutDrawDescription?.(
          multiplayerSides(props.game).find(
            (side) => props.game[`${side}_ms`] === 0
          ) ?? 'white'
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
  const diff = () => props.game[`${ownSide(props)}_rating_diff`] ?? null;
  return (
    <Show when={props.viewer.participant && diff() !== null}>
      <Badge
        intent={
          (diff() ?? 0) > 0
            ? 'success'
            : (diff() ?? 0) < 0
              ? 'destructive'
              : 'neutral'
        }
        label={
          <Trans>
            <VisuallyHidden>Your rating changed by </VisuallyHidden>
            {(diff() ?? 0) > 0 ? '+' : ''}
            {diff() ?? 0}
            <VisuallyHidden>.</VisuallyHidden>
          </Trans>
        }
        tone="solid"
        dataSet={{ testid: 'multiplayer-rating-change' }}
      />
    </Show>
  );
}

function Offers(props: StatusProps): JSX.Element {
  const drawName = useShownName(() => props.game.draw_offer_by ?? '');
  const rematchName = useShownName(() => props.game.rematch_offer_by ?? '');
  const offeredToMe = (by: string | null) =>
    props.viewer.participant &&
    Boolean(
      by &&
        by !== props.viewer.myId &&
        multiplayerSideOf(props.game, by) !== null
    );
  return (
    <>
      <Show when={offeredToMe(props.game.draw_offer_by)}>
        <Trans>{drawName()} offered you a multiplayer draw.</Trans>{' '}
      </Show>
      <Show when={offeredToMe(props.game.rematch_offer_by)}>
        <Trans>{rematchName()} offered you a multiplayer rematch.</Trans>{' '}
      </Show>
    </>
  );
}

/** After the headline: why a finished game ended, offers, the rating change. */
export function MultiplayerStatusDetail(props: StatusProps): JSX.Element {
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

/** Whether {@link MultiplayerStatusDetail} has anything to say. */
export function multiplayerStatusHasDetail(props: StatusProps): boolean {
  const game = props.game;
  if (game.outcome !== 'ongoing' && game.reason !== 'abort') return true;
  if (!props.viewer.participant) return false;
  const offered = (by: string | null) =>
    Boolean(
      by && by !== props.viewer.myId && multiplayerSideOf(game, by) !== null
    );
  return (
    offered(game.draw_offer_by) ||
    offered(game.rematch_offer_by) ||
    game[`${ownSide(props)}_rating_diff`] != null
  );
}

/** The person's own clock is the one that is low on time. */
const ownClockLow = (props: StatusProps): boolean =>
  props.lowOnTime !== null &&
  props.viewer.participant &&
  props.lowOnTime.side === ownSide(props);

function tone(props: StatusProps): GameTurnPillTone {
  const game = props.game;
  if (ownClockLow(props)) return 'warning';
  if (game.outcome === 'ongoing') return 'neutral';
  const won = props.viewer.participant && game.outcome === ownSide(props);
  return won ? 'success' : 'neutral';
}

/** The viewer is to move. */
function emphasis(props: StatusProps): GameTurnPillEmphasis {
  return props.game.outcome === 'ongoing' &&
    props.game.turn === props.viewer.myId
    ? 'yours'
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
  props.game.clock_at_ms !== null &&
  props.game.paused_at_ms === null &&
  !bothHaveMoved(props.game) &&
  !isDailyTimeControl(props.game.time_control);

/**
 * The headline: a paused game says so first, then whose turn it is or how
 * the game ended, and for a listener a clock that became low on time.
 */
export function MultiplayerStatusTitle(props: StatusProps): JSX.Element {
  return (
    <>
      <Show
        when={
          props.game.outcome === 'ongoing' && props.game.paused_at_ms !== null
        }
      >
        <Text variant="inherit" testId="multiplayer-paused">
          <Show
            when={timeControlOf(props.game.time_control) !== null}
            fallback={<Trans>Multiplayer game is paused.</Trans>}
          >
            <Trans>Multiplayer clocks are paused.</Trans>
          </Show>{' '}
        </Text>
      </Show>
      <Show
        when={props.viewer.participant}
        fallback={<WatcherHeadline {...props} />}
      >
        <PlayerHeadline {...props} />
      </Show>
      <LowOnTimeWords {...props} />
    </>
  );
}

/**
 * The seat to move already says whose turn it is (`Your move`), so the
 * plain line is for a listener only. Anything more (a pause, an offer, a
 * first-move deadline, a low clock, the result) is shown.
 */
function seatsSayIt(props: StatusProps): boolean {
  return (
    props.game.outcome === 'ongoing' &&
    props.game.paused_at_ms === null &&
    props.lowOnTime === null &&
    !multiplayerStatusHasDetail(props) &&
    !awaitingFirstMoves(props)
  );
}

/**
 * Where the game stands, in one line under the board: whose turn, or how it
 * ended and why. It is the screen's live announcement, so a listener hears
 * colour, turn, offers and the result as they change.
 */
export function MultiplayerStatus(props: StatusProps): JSX.Element {
  // A game's own words about the turn (`First to e5 wins.`) are shown.
  const turnStatus = useFrameTurnStatus(props);
  return (
    <GameTurnPill
      live
      spokenOnly={seatsSayIt(props) && turnStatus() === null}
      emphasis={emphasis(props)}
      tone={tone(props)}
      dataSet={{ testid: 'multiplayer-announcement' }}
      title={<MultiplayerStatusTitle {...props} />}
      detail={
        multiplayerStatusHasDetail(props) ? (
          <MultiplayerStatusDetail {...props} />
        ) : undefined
      }
      note={
        awaitingFirstMoves(props) ? (
          <FirstMoveCountdown {...props} />
        ) : undefined
      }
    />
  );
}

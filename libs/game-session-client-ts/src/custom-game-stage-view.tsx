import { t } from '@lingui/core/macro';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';

import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import {
  FixedGameSession,
  type GameSessionAllMoves,
} from '@pkgs/ui-root-client-ts/game-session-layout';

import { GameWatcherCount } from '@pkgs/ui-root-client-ts/game-watching';
import { EllipsisIcon } from '@pkgs/ui-root-client-ts/icons';
import { P } from '@pkgs/ui-root-client-ts/text';

import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import type { FramePlaceProps } from './custom-game-screen-view';
import { FrameMovesCard } from './game-frame-moves-view';
import { FrameStage } from './game-frame-stage';
import {
  FrameDrawOfferLine,
  FrameErrorView,
  FrameFactsView,
  FrameStageConditionLine,
  FrameStatusView,
  frameStageHeldUp,
  frameWatchersLabel,
} from './game-frame-status-view';
import type { FramePlaySeat } from './game-frame-view-types';

type Props = FramePlaceProps;

/** The title-row facts and exact watcher count. */
export function FrameFacts(props: Props): JSX.Element {
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

/** The name of the one seat to move, for a watcher's line. */
function moverName(props: Props): string | null {
  const seats = [props.table.near, ...props.table.others].filter(
    (seat): seat is FramePlaySeat => seat !== null && seat.deciding
  );
  return seats.length === 1 ? (seats[0]?.plainName ?? null) : null;
}

/** A game played in real time: no turns, so no moves and no seat to move. */
function realTime(props: Props): boolean {
  return props.record !== null && !props.record.turns;
}

/**
 * Whether the line about the game is for a listener only: a real-time
 * game's default line only repeats the hint under its arena. A turn game's
 * line stays in view on the status band over the commands, so the band is
 * never a blank strip and says whose turn it is right by the commands.
 */
function lineSpokenOnly(props: Props): boolean {
  const status = props.status;
  if (status === null || !status.plainTurn || status.sending) return false;
  if (status.tone !== 'neutral') return false;
  return realTime(props);
}

/**
 * The one line about the game, leading its commands (under the person's
 * own seat on a phone, heading the rail beside a wide board), never
 * between the board and the seats, so the board and the people around it
 * stay one unit that fits the window.
 */
function PlayLine(props: Props): JSX.Element {
  // The viewer's own plain turn reads "Your turn.", the sentence the
  // matchmaking stage uses, beside the seat that says "Your move".
  // Someone else's plain turn names the player, as a watcher's line does
  // ("jordan_plays to move."), not only their pieces.
  const status = (): Props['status'] => {
    const line = props.status;
    if (line === null || !line.plainTurn) return line;
    if (line.emphasis === 'yours')
      return { ...line, description: t`Your turn.` };
    const name = moverName(props);
    return name === null ? line : { ...line, description: t`${name} to move.` };
  };
  return (
    <FrameStatusView
      status={status()}
      arena={realTime(props)}
      quiet
      spokenOnly={lineSpokenOnly(props)}
    />
  );
}

/** Whether the game's commands place holds anything for this viewer. */
export function commandsOffered(props: Props): boolean {
  return (
    props.play.canOfferDraw ||
    props.play.offerAgainLater ||
    props.play.canResign ||
    props.play.canCancel ||
    props.record?.history === true
  );
}

/**
 * Offering a draw and resigning while the connection is away: still in
 * their places, held back, under the notice that says why.
 */
function HeldActions(props: Props): JSX.Element {
  return (
    <>
      <Show when={props.play.heldOfferDraw}>
        <Button
          title={<Trans>Offer draw</Trans>}
          variant="outline"
          intent="neutral"
          disabled
          dataSet={{ testid: 'custom-game-offer-draw-held' }}
        />
      </Show>
      <Show when={props.play.heldResign}>
        <Button
          title={<Trans>Resign</Trans>}
          variant="outline"
          intent="neutral"
          disabled
          dataSet={{ testid: 'custom-game-resign-held' }}
        />
      </Show>
    </>
  );
}

/**
 * What is done from the live board: the board's own actions, an answer the
 * game is waiting for (a draw offered, a win to claim), and the one way to
 * everything else, the game's commands.
 */
/**
 * A stopped game's bar: the one way on, Reopen game, filled; offer and
 * resign wait until it runs again (the menu stays for the rest).
 */
function StoppedActions(props: Props): JSX.Element {
  return (
    <GameActionBar items={[]} aria-label={t`Game actions`} width="content">
      <Button
        title={<Trans>Reopen game</Trans>}
        variant="solid"
        onClick={() => props.onReopen?.()}
        dataSet={{ testid: 'custom-game-reopen' }}
      />
      <Show when={commandsOffered(props)}>
        <Button
          title={<Trans>Game menu</Trans>}
          variant="outline"
          intent="neutral"
          icon={EllipsisIcon}
          onClick={() => props.onOpen({ screen: 'commands' })}
          dataSet={{ testid: 'custom-game-commands' }}
        />
      </Show>
    </GameActionBar>
  );
}

function PlayActions(props: Props): JSX.Element {
  return (
    <Show
      when={!(props.stopped && props.onReopen !== undefined)}
      fallback={<StoppedActions {...props} />}
    >
      <LiveActions {...props} />
    </Show>
  );
}

function LiveActions(props: Props): JSX.Element {
  return (
    <GameActionBar
      aria-label={t`Game actions`}
      items={[]}
      width="content"
      dataSet={{ answering: String(props.play.canAnswerDraw) }}
    >
      <Show when={props.play.canAnswerDraw}>
        {/* The answer the game waits for leads, filled; the bar it
            replaces (offer, resign) is gone until it is given. */}
        <GameActionButton
          title={
            <Trans>
              Accept<VisuallyHidden> draw</VisuallyHidden>
            </Trans>
          }
          variant="solid"
          dataSet={{ testid: 'custom-game-agree' }}
          operation={() => props.onChoose({ operation: 'agree' })}
        />
        <GameActionButton
          title={
            <Trans>
              Decline<VisuallyHidden> draw</VisuallyHidden>
            </Trans>
          }
          dataSet={{ testid: 'custom-game-reject' }}
          operation={() => props.onChoose({ operation: 'reject' })}
        />
      </Show>
      <Show when={props.play.canClaimWin}>
        <GameActionButton
          title={<Trans>Claim the win</Trans>}
          variant="solid"
          dataSet={{ testid: 'custom-game-claim-win' }}
          operation={() => props.onChoose({ operation: 'claimWin' })}
        />
      </Show>
      <Show when={props.play.canOfferDraw && !props.menuMatchCommands}>
        <GameActionButton
          title={<Trans>Offer draw</Trans>}
          dataSet={{ testid: 'custom-game-offer-draw' }}
          operation={() => props.onChoose({ operation: 'offer' })}
        />
      </Show>
      {/* An offered draw is answered first: resigning waits in the menu. */}
      <Show
        when={
          props.play.canResign &&
          !props.play.canAnswerDraw &&
          !props.menuMatchCommands
        }
      >
        <Button
          title={<Trans>Resign</Trans>}
          variant="outline"
          intent="danger"
          onClick={() => props.onConfirm('resign')}
          dataSet={{ testid: 'custom-game-resign-now' }}
        />
      </Show>
      <HeldActions {...props} />
      <Show when={commandsOffered(props)}>
        <Button
          // Named in words: the bar's ••• is the space's menu, this is the game's.
          title={<Trans>Game menu</Trans>}
          variant="outline"
          intent="neutral"
          icon={EllipsisIcon}
          onClick={() => props.onOpen({ screen: 'commands' })}
          dataSet={{ testid: 'custom-game-commands' }}
        />
      </Show>
    </GameActionBar>
  );
}

/** The way from the line of moves to every move, once one is played. */
function allMovesOf(props: Props): GameSessionAllMoves | undefined {
  const record = props.record;
  if (record === null || !record.turns || record.moves.length === 0)
    return undefined;
  return {
    label: <Trans>All moves</Trans>,
    testId: 'custom-game-all-moves',
    onPress: () => {
      props.onSeek(record.displayedPly);
      props.onOpen({ screen: 'moves' });
    },
  };
}

/**
 * The play place: the live position and what playing needs now, in one
 * bar: an answer the game waits for, offering a draw, resigning (confirmed)
 * and the game's menu, where the moves, the history and the rest wait. The
 * board never shows an earlier move here (that is the moves place).
 */
export function CustomGameStagePlace(props: Props): JSX.Element {
  return (
    <GameScreen
      screenId="custom-game-stage"
      title={props.title}
      compactInset={props.table.compactInset}
      facts={<FrameFacts {...props} />}
    >
      <FixedGameSession
        dataSet={{
          component: 'CustomGameContent',
          testid: 'custom-game-content',
          phase: props.phase,
          place: props.place.screen,
        }}
        // What comes and goes (the connection, a refused choice, a draw
        // offered) lies over the stage's top, never in its flow, so the
        // board does not move when it appears or clears.
        // A refused choice is an event: it floats in the alerts. What holds
        // the game up stays on the status line below.
        notices={
          <>
            <Show when={props.connection === 'offline-local'}>
              <P variant="caption" role="status">
                <Trans>You're offline. Your local game can continue.</Trans>
              </P>
            </Show>
            <FrameErrorView text={props.error} />
          </>
        }
        status={
          // Someone watching is told so on the bar's own status line, so
          // their board keeps the players' full width and place.
          <Show
            when={props.phase === 'active' && props.viewerSide === null}
            fallback={
              <Show
                when={!frameStageHeldUp(props)}
                fallback={<FrameStageConditionLine {...props} />}
              >
                <Show
                  when={props.play.drawOffered}
                  fallback={<PlayLine {...props} />}
                >
                  <FrameDrawOfferLine play={props.play} people={props.people} />
                </Show>
              </Show>
            }
          >
            <P
              variant="caption"
              tone="secondary"
              align="center"
              testId="custom-game-watching"
            >
              {/* Whose move it is, as the matchmaking band says it. */}
              <Show
                when={props.status?.plainTurn ? props.status : null}
                fallback={
                  <Trans>
                    You're watching. Moves appear as they're played.
                  </Trans>
                }
              >
                {(line) => (
                  // The player to move by name, as the matchmaking band says
                  // it; the side's words when no seat is to move.
                  <Show
                    when={moverName(props)}
                    fallback={
                      <Trans>You're watching. {line().description}</Trans>
                    }
                  >
                    {(name) => (
                      <Trans>You're watching. {name()} to move.</Trans>
                    )}
                  </Show>
                )}
              </Show>
            </P>
          </Show>
        }
        actions={<PlayActions {...props} />}
        history={<FrameMovesCard {...props} />}
        allMoves={allMovesOf(props)}
      >
        {(information) => <FrameStage {...props} information={information} />}
      </FixedGameSession>
    </GameScreen>
  );
}

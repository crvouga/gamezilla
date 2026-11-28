import { t } from '@lingui/core/macro';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { EllipsisIcon } from '@pkgs/ui-root-client-ts/icons';
import { P } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import {
  FrameDrawOfferLine,
  FrameStageConditionLine,
  FrameStatusView,
  frameStageHeldUp,
} from './game-frame-status-view';
import type { FramePlaySeat } from './game-frame-view-types';
import {
  FrameFacts,
  GameSessionBoardLayout,
} from './game-session-board-layout';
import type { FramePlaceProps } from './game-session-screen-view';

type Props = FramePlaceProps;

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
          dataSet={{ testid: 'game-session-offer-draw-held' }}
        />
      </Show>
      <Show when={props.play.heldResign}>
        <Button
          title={<Trans>Resign</Trans>}
          variant="outline"
          intent="neutral"
          disabled
          dataSet={{ testid: 'game-session-resign-held' }}
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
        dataSet={{ testid: 'game-session-reopen' }}
      />
      <Show when={commandsOffered(props)}>
        <Button
          title={<Trans>Game menu</Trans>}
          variant="outline"
          intent="neutral"
          icon={EllipsisIcon}
          onClick={() => props.onOpen({ screen: 'commands' })}
          dataSet={{ testid: 'game-session-commands' }}
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
      items={props.play.sessionActions}
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
          dataSet={{ testid: 'game-session-agree' }}
          operation={() => props.onChoose({ operation: 'agree' })}
        />
        <GameActionButton
          title={
            <Trans>
              Decline<VisuallyHidden> draw</VisuallyHidden>
            </Trans>
          }
          dataSet={{ testid: 'game-session-reject' }}
          operation={() => props.onChoose({ operation: 'reject' })}
        />
      </Show>
      <Show when={props.play.canClaimWin}>
        <GameActionButton
          title={<Trans>Claim the win</Trans>}
          variant="solid"
          dataSet={{ testid: 'game-session-claim-win' }}
          operation={() => props.onChoose({ operation: 'claimWin' })}
        />
      </Show>
      <Show when={props.play.canOfferDraw && !props.menuMatchCommands}>
        <GameActionButton
          title={<Trans>Offer draw</Trans>}
          dataSet={{ testid: 'game-session-offer-draw' }}
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
          dataSet={{ testid: 'game-session-resign-now' }}
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
          dataSet={{ testid: 'game-session-commands' }}
        />
      </Show>
    </GameActionBar>
  );
}

/** The way from the line of moves to every move, once one is played. */
/**
 * Play Friend's board: the live position and what playing people needs
 * now. A bot game has its own play screen.
 */
export function PlayFriendStagePlace(props: Props): JSX.Element {
  return (
    <GameSessionBoardLayout
      {...props}
      facts={<FrameFacts {...props} />}
      statusLine={
        <>
          <Show when={props.connection === 'offline-local'}>
            <P variant="caption" tone="default" role="status">
              <Trans>You're offline. Your local game can continue.</Trans>
            </P>
          </Show>
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
              testId="game-session-watching"
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
        </>
      }
      actions={<PlayActions {...props} />}
    />
  );
}

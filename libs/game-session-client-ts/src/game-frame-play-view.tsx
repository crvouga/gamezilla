import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { GameTableSeats } from '@pkgs/ui-root-client-ts/game-table-seat';
import { GameWatcherCount } from '@pkgs/ui-root-client-ts/game-watching';
import { MenuIcon } from '@pkgs/ui-root-client-ts/icons';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { type JSX, Show } from 'solid-js';
import { FrameMovesCard } from './game-frame-moves-view';
import { FrameOverlay } from './game-frame-overlay-view';
import type { FramePlaceProps } from './game-frame-screen-view';
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

/**
 * The board as the game draws it. A board that seats every player itself
 * (`table.shape === 'board'`) is lent each of them.
 */
export function FrameBoard(props: Props): JSX.Element {
  return (
    <Show when={props.table.shape === 'board'} fallback={props.board}>
      <GameTableSeats
        seat={(side) => ({
          get name() {
            const seat = [props.table.near, ...props.table.others].find(
              (player) => player?.side === side
            );
            return seat?.plainName ?? null;
          },
          content: (
            <FrameBoardSeatView
              table={props.table}
              people={props.people}
              viewerSide={props.viewerSide}
              side={side}
            />
          ),
        })}
      >
        {props.board}
      </GameTableSeats>
    </Show>
  );
}

/** A game played in real time: no turns, so no moves and no seat to move. */
function realTime(props: Props): boolean {
  return props.record !== null && !props.record.turns;
}

/**
 * Whether the line about the game is for a listener only, because the
 * screen already says it: the seat to move says the plain `<Side> to
 * move.` itself, and a real-time game's default line only repeats the hint
 * under its arena.
 */
function lineSpokenOnly(props: Props, compact: boolean): boolean {
  const status = props.status;
  if (status === null || !status.plainTurn || status.sending) return false;
  if (status.tone !== 'neutral') return false;
  return realTime(props) || tableShowsTurn(props.table, compact);
}

/**
 * The one line about the game, leading its commands (under the person's
 * own seat on a phone, heading the rail beside a wide board), never
 * between the board and the seats, so the board and the people around it
 * stay one unit that fits the window.
 */
function PlayLine(props: Props): JSX.Element {
  const mode = useLayoutMode();
  return (
    <FrameStatusView
      status={props.status}
      arena={realTime(props)}
      spokenOnly={lineSpokenOnly(props, mode() !== 'wide')}
    />
  );
}

/**
 * The board and the people around it: the other seats above, the game's
 * required choice, the board, then the person's own seat nearest them. The
 * live position while the game is played, the final one once it is over.
 */
export function FrameStage(props: Props): JSX.Element {
  // The seats' density only: chips on a phone at a bigger table, strips
  // otherwise. What the stage shows is the same on every size.
  const mode = useLayoutMode();
  const compact = (): boolean => mode() !== 'wide';
  return (
    <GameBoardStage
      viewportFit={props.boardFit}
      align={props.boardAlign}
      dataSet={{
        ...props.boardState,
        testid: 'custom-game-public',
        overlay: props.overlay.kind,
      }}
      overlay={<FrameOverlay {...props} />}
      others={
        <>
          <FrameOthersView
            table={props.table}
            people={props.people}
            onChoose={props.onChoose}
            viewerSide={props.viewerSide}
            compact={compact()}
          />
          <GameActionBar items={props.play.leadingBoardActions} />
        </>
      }
      own={
        <FrameNearSeatView
          table={props.table}
          people={props.people}
          onChoose={props.onChoose}
          viewerSide={props.viewerSide}
          compact={compact()}
        />
      }
    >
      <FrameBoard {...props} />
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
function PlayActions(props: Props): JSX.Element {
  return (
    <GameActionBar
      aria-label={t`Game actions`}
      items={props.play.boardActions}
      width="content"
      dataSet={{ answering: String(props.play.canAnswerDraw) }}
    >
      <Show when={props.play.canAnswerDraw}>
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
      <Show when={props.play.canOfferDraw}>
        <GameActionButton
          title={<Trans>Offer draw</Trans>}
          dataSet={{ testid: 'custom-game-offer-draw' }}
          operation={() => props.onChoose({ operation: 'offer' })}
        />
      </Show>
      {/* An offered draw is answered first: resigning waits in the menu. */}
      <Show when={props.play.canResign && !props.play.canAnswerDraw}>
        <Button
          title={<Trans>Resign</Trans>}
          variant="outline"
          intent="neutral"
          onClick={() => props.onConfirm('resign')}
          dataSet={{ testid: 'custom-game-resign-now' }}
        />
      </Show>
      <HeldActions {...props} />
      <Show when={commandsOffered(props)}>
        <Button
          title={<Trans>Menu</Trans>}
          aria-label={t`Game menu`}
          variant="outline"
          intent="neutral"
          startIcon={<MenuIcon size={20} />}
          onClick={() => props.onOpen({ screen: 'commands' })}
          dataSet={{ testid: 'custom-game-commands' }}
        />
      </Show>
    </GameActionBar>
  );
}

/**
 * The play place: the live position and what playing needs now, in one
 * bar: an answer the game waits for, offering a draw, resigning (confirmed)
 * and the game's menu, where the moves, the history and the rest wait. The
 * board never shows an earlier move here (that is the moves place). A game
 * this device watched begin opens under the versus card (`overlay`).
 */
export function FramePlayPlace(props: Props): JSX.Element {
  return (
    <GameScreen
      screenId="custom-game"
      title={props.title}
      compactInset={props.table.compactInset}
      facts={<FrameFacts {...props} />}
    >
      <GameSessionLayout
        dataSet={{
          component: 'CustomGameContent',
          testid: 'custom-game-content',
          phase: props.phase,
          place: props.place.screen,
        }}
        notices={<FrameConnectionView connection={props.connection} />}
        boardFocus
        actionsBeside
        fixedStage
        // A refused choice is said with the game's commands (under a
        // phone's board, heading the rail beside a wide one), never above
        // the board, so the board does not move when it appears or clears.
        status={
          <>
            <PlayLine {...props} />
            <FrameErrorView text={props.error} />
            <FramePlayNoticesView play={props.play} people={props.people} />
          </>
        }
        actions={<PlayActions {...props} />}
        aside={<FrameMovesCard {...props} />}
        footer={
          <FrameWatchingView
            phase={props.phase}
            viewerSide={props.viewerSide}
          />
        }
      >
        <FrameStage {...props} />
      </GameSessionLayout>
    </GameScreen>
  );
}

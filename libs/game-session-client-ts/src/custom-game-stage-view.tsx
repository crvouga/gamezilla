import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionBar } from '@pkgs/ui-root-client-ts/game-action-bar';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import {
  type GameSessionAllMoves,
  GameSessionLayout,
} from '@pkgs/ui-root-client-ts/game-session-layout';
import { GameTableSeats } from '@pkgs/ui-root-client-ts/game-table-seat';
import { GameWatcherCount } from '@pkgs/ui-root-client-ts/game-watching';
import { EllipsisIcon } from '@pkgs/ui-root-client-ts/icons';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { type JSX, Show } from 'solid-js';
import type { FramePlaceProps } from './custom-game-screen-view';
import { FrameMovesCard } from './game-frame-moves-view';
import { FrameOverlay } from './game-frame-overlay-view';
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

/** The versus card still counts in: the game has not reached the board. */
function counting(props: Props): boolean {
  return props.overlay.kind === 'versus';
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
      <Show when={props.play.canOfferDraw}>
        <GameActionButton
          title={<Trans>Offer draw</Trans>}
          disabled={counting(props)}
          dataSet={{ testid: 'custom-game-offer-draw' }}
          operation={() => props.onChoose({ operation: 'offer' })}
        />
      </Show>
      {/* An offered draw is answered first: resigning waits in the menu. */}
      <Show when={props.play.canResign && !props.play.canAnswerDraw}>
        <Button
          title={<Trans>Resign</Trans>}
          variant="outline"
          intent="danger"
          disabled={counting(props)}
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
 * board never shows an earlier move here (that is the moves place). A game
 * this device watched begin opens under the versus card (`overlay`).
 */
export function CustomGameStagePlace(props: Props): JSX.Element {
  return (
    <GameScreen
      screenId="custom-game-stage"
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
        // What comes and goes (the connection, a refused choice, a draw
        // offered) lies over the stage's top, never in its flow, so the
        // board does not move when it appears or clears.
        notices={
          <>
            <FrameConnectionView connection={props.connection} />
            <FrameErrorView text={props.error} />
            {/* The engine stopped: said over the stage with the way back
                in, never in the board's flow (the board never moves). */}
            <FrameErrorView
              text={
                props.stopped
                  ? t`The game stopped. Your last saved score is kept.`
                  : ''
              }
              retry={
                props.onReopen === undefined
                  ? undefined
                  : { label: t`Reopen game`, onPress: () => props.onReopen?.() }
              }
            />
            <FramePlayNoticesView play={props.play} people={props.people} />
          </>
        }
        boardFocus
        actionsBeside
        fixedStage={props.boardWorkspace !== true}
        status={<PlayLine {...props} />}
        actions={<PlayActions {...props} />}
        aside={<FrameMovesCard {...props} />}
        allMoves={allMovesOf(props)}
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

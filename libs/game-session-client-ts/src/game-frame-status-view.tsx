import { plural, t } from '@lingui/core/macro';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { GameFact, GameFacts } from '@pkgs/ui-root-client-ts/game-facts';
import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import { GameWatchingFooter } from '@pkgs/ui-root-client-ts/game-watching';
import { WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { ToastStack } from '@pkgs/ui-root-client-ts/toast-stack';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import type { JSX } from '@solidjs/web';
import { Match, Show, Switch } from 'solid-js';
import { FramePersonName } from './game-frame-people';
import type {
  FrameConnection,
  FramePeople,
  FramePhase,
  FramePlay,
  FrameStatus,
} from './game-frame-view-types';

/**
 * The line a caption says: the game's own line, or, while the viewer's
 * choice is being sent, that it is being sent, in the same place, so the
 * screen never shows a second status row for it.
 */
export function captionLine(status: FrameStatus): string {
  return status.sending ? t`Sending choice…` : status.description;
}

/**
 * The agreed clock in plain words (`10 min + 5 sec`, `Untimed`), where a
 * game is set up and someone may not know what `10+5` means.
 */
export function FrameClockWords(props: {
  readonly minutes: number;
  readonly increment: number;
}): JSX.Element {
  return (
    <Switch fallback={<Trans>Untimed</Trans>}>
      <Match when={props.minutes > 0 && props.increment > 0}>
        <Trans>
          {props.minutes} min + {props.increment} sec
        </Trans>
      </Match>
      <Match when={props.minutes > 0}>
        <Trans>{props.minutes} min</Trans>
      </Match>
    </Switch>
  );
}

/**
 * The agreed clock: minutes + added seconds. An untimed game names what it
 * is played to instead, when it says (`First to 11`).
 */
function TimeControlFact(props: { readonly status: FrameStatus }): JSX.Element {
  return (
    <Show
      when={props.status.minutes === 0 ? props.status.target : undefined}
      fallback={
        <GameFact
          label={
            <Show
              when={props.status.minutes > 0}
              fallback={<Trans>Untimed</Trans>}
            >
              {props.status.minutes}+{props.status.increment}
            </Show>
          }
        />
      }
    >
      {(target) => <GameFact label={target()} testId="game-session-target" />}
    </Show>
  );
}

/**
 * The game's facts for the title row, as one quiet line (`Unrated ·
 * Untimed`, `Unrated · First to 11`): settings, never pills that look pressable, in the same words
 * a search for an opponent uses.
 */
export function FrameFactsView(props: {
  readonly status: FrameStatus | null;
}): JSX.Element {
  return (
    <Show when={props.status}>
      {(status) => (
        <GameFacts>
          <GameFact
            label={<Trans>Unrated</Trans>}
            testId="game-session-unrated"
          />
          <TimeControlFact status={status()} />
        </GameFacts>
      )}
    </Show>
  );
}

/**
 * Where the game stands, in one line: the eye reads the state beside the
 * seats; a listener, who cannot see the seats, first hears who holds them.
 * With no game yet only a listener hears it. When the screen already shows
 * the same thing (`spokenOnly`: the seat to move says whose move it is, the
 * Start section says whether the game can start), the line is for a
 * listener only.
 */
export function FrameStatusView(props: {
  readonly status: FrameStatus | null;
  readonly spokenOnly?: boolean | undefined;
  /**
   * A game played in real time: a neutral line that only says how play
   * goes on (`Keep the ball in play.`) is plain hint text, not a pill that
   * reads as a button under the arena.
   */
  readonly arena?: boolean | undefined;
  /**
   * On the command bar's status band: a neutral line is quiet text, never
   * a pill that reads as one more button beside the commands.
   */
  readonly quiet?: boolean | undefined;
}): JSX.Element {
  return (
    <Show
      when={props.status}
      fallback={
        <VisuallyHidden
          role="status"
          aria-live="polite"
          testId="game-session-status"
        >
          <Trans>No Game Session.</Trans>
        </VisuallyHidden>
      }
    >
      {(status) => (
        <GameTurnPill
          live
          emphasis={status().emphasis}
          tone={status().tone}
          dataSet={{ testid: 'game-session-status' }}
          title={
            <>
              <VisuallyHidden>{status().lineup} </VisuallyHidden>
              <Show when={status().sending} fallback={status().description}>
                <Trans>Sending choice…</Trans>
              </Show>
            </>
          }
          spokenOnly={
            props.spokenOnly === true ||
            (status().description.trim() === '' && !status().sending)
          }
          look={
            status().tone === 'neutral' &&
            !status().sending &&
            (props.quiet === true ||
              (props.arena === true && status().emphasis !== 'yours'))
              ? 'plain'
              : 'pill'
          }
        />
      )}
    </Show>
  );
}

/** Offline: whether the game can go on here, waits, or needs the connection. */
export function FrameConnectionView(props: {
  readonly connection: FrameConnection;
  /** Before any game: the notice speaks of starting one, not of moves. */
  readonly beforeGame?: boolean | undefined;
}): JSX.Element {
  return (
    // No connection comes and goes: it floats with the screen's alerts,
    // and stays, with no close, for as long as it holds.
    <ToastStack placement="above-actions" persistent>
      <FrameConnectionNotice
        connection={props.connection}
        beforeGame={props.beforeGame}
      />
    </ToastStack>
  );
}

/**
 * The offline notice itself, for a surface that places its own alerts (the
 * Game over dialog says it above Rematch, never under a floating card).
 */
export function FrameConnectionNotice(props: {
  readonly connection: FrameConnection;
  readonly beforeGame?: boolean | undefined;
  /** After the game: what the next game's choices wait for. */
  readonly afterGame?: boolean | undefined;
}): JSX.Element {
  return (
    <Show when={props.connection !== 'online'}>
      {/* After the game it is one line over the commands it holds, in the
          Game over card; during the game, an alert. */}
      <Show
        when={props.afterGame !== true}
        fallback={
          <P
            variant="caption"
            tone="warning"
            role="status"
            lines={2}
            testId="game-session-connection-needed"
          >
            <Trans>
              Offline. Rematch or New game is sent when you're back.
            </Trans>
          </P>
        }
      >
        <Notice
          tone="warning"
          icon={WifiOffIcon}
          dataSet={{ testid: 'game-session-connection-needed' }}
        >
          <Text variant="inherit" role="status">
            <Switch
              fallback={
                <Trans>
                  You're offline. Moves wait for the connection; anything else
                  you choose now is sent when it returns.
                </Trans>
              }
            >
              <Match when={props.afterGame === true}>
                <Trans>
                  You're offline. Rematch or New game is sent when the
                  connection returns.
                </Trans>
              </Match>
              <Match when={props.beforeGame === true}>
                <Trans>
                  You're offline. A game you start now begins when the
                  connection returns.
                </Trans>
              </Match>
              <Match when={props.connection === 'waiting'}>
                <Trans>
                  Your move will be played when the connection returns.
                </Trans>
              </Match>
              <Match when={props.connection === 'offline-local'}>
                <Trans>You're offline. Your local game can continue.</Trans>
              </Match>
            </Switch>
          </Text>
        </Notice>
      </Show>
    </Show>
  );
}

/** A refused choice, in words; nothing for none. */
export function FrameErrorView(props: {
  readonly text: string;
  /** What happened, as the alert's title; a refused choice by default. */
  readonly title?: string | undefined;
  /**
   * One line over the commands it explains (in the Game over card, over
   * "Retry rematch"): the reason only, in the error's tone.
   */
  readonly line?: boolean | undefined;
}): JSX.Element {
  return (
    <Show when={props.text !== ''}>
      <Show
        when={props.line !== true}
        fallback={
          <P
            variant="caption"
            tone="destructive"
            role="alert"
            lines={2}
            testId="game-session-error"
          >
            {props.text}
          </P>
        }
      >
        <ErrorState
          variant="compact"
          title={props.title ?? t`That didn't go through`}
          body={props.text}
          dataSet={{ testid: 'game-session-error' }}
        />
      </Show>
    </Show>
  );
}

/**
 * A draw offered, said on the command bar's status line beside the answer
 * it waits for (Accept, Decline): a decision stays in view until it is
 * made, never only in an alert that can be closed.
 */
export function FrameDrawOfferLine(props: {
  readonly play: FramePlay;
  readonly people?: FramePeople | undefined;
}): JSX.Element {
  // Waiting for the person's answer, the offer takes the turn's own filled
  // pill: it is the loudest thing on the bar until it is answered.
  return (
    <GameTurnPill
      live
      emphasis={props.play.canAnswerDraw ? 'yours' : 'neutral'}
      dataSet={{ testid: 'game-session-draw-offer' }}
      title={<FrameDrawOfferWords {...props} />}
    />
  );
}

function FrameDrawOfferWords(props: {
  readonly play: FramePlay;
  readonly people?: FramePeople | undefined;
}): JSX.Element {
  return (
    <>
      <Show
        when={props.play.canAnswerDraw}
        fallback={<Trans>A draw is offered. Waiting for an answer.</Trans>}
      >
        <Show
          when={props.play.drawOfferer}
          fallback={<Trans>You were offered a draw.</Trans>}
        >
          {(offerer) => (
            <>
              <FramePersonName
                person={offerer().person}
                plainName={offerer().plainName}
                people={props.people}
              />{' '}
              <Trans>offered you a draw.</Trans>
            </>
          )}
        </Show>
      </Show>
    </>
  );
}

/**
 * What holds a game up, said on the command bar's status line, where it
 * stays in view until it ends and never covers the board or a seat: the
 * engine stopped, no connection, an opponent away. Nothing while none does.
 */
export function FrameStageConditionLine(props: {
  readonly stopped: boolean;
  readonly connection: FrameConnection;
  readonly play: FramePlay;
  readonly people?: FramePeople | undefined;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.stopped}>
        <P
          variant="caption"
          tone="destructive"
          align="center"
          role="status"
          lines={2}
        >
          <Trans>Game stopped. Reopen it to play on from here.</Trans>
        </P>
      </Match>
      <Match
        when={props.connection === 'waiting' || props.connection === 'needed'}
      >
        <P
          variant="caption"
          tone="warning"
          align="center"
          role="status"
          lines={2}
          testId="game-session-connection-needed"
        >
          <Switch
            fallback={<Trans>You're offline. Moves need a connection.</Trans>}
          >
            <Match when={props.connection === 'waiting'}>
              <Trans>
                Your move will be played when the connection returns.
              </Trans>
            </Match>
          </Switch>
        </P>
      </Match>
      <Match when={props.play.away}>
        {(away) => (
          <P
            variant="caption"
            align="center"
            role="status"
            lines={2}
            testId="game-session-away"
          >
            <FramePersonName
              person={away().person}
              plainName={away().plainName}
              people={props.people}
            />{' '}
            <Switch
              fallback={
                <Trans>is away. Their turn waits until they return.</Trans>
              }
            >
              <Match when={props.play.canClaimWin}>
                <Trans>is away. You may claim the win.</Trans>
              </Match>
              <Match when={away().twoSided}>
                <Trans>is away. After a minute you may claim the win.</Trans>
              </Match>
            </Switch>
          </P>
        )}
      </Match>
    </Switch>
  );
}

/** Whether something holds the game up (see `FrameStageConditionLine`). */
export function frameStageHeldUp(props: {
  readonly stopped: boolean;
  readonly connection: FrameConnection;
  readonly play: FramePlay;
}): boolean {
  return (
    props.stopped ||
    props.connection === 'needed' ||
    props.connection === 'waiting' ||
    props.play.away !== null
  );
}

/** The calm bar under a game under way that the person watches, not plays. */
export function FrameWatchingView(props: {
  readonly phase: FramePhase;
  /** The viewer's own seat; `null` while watching. */
  readonly viewerSide: string | null;
}): JSX.Element {
  return (
    <Show when={props.phase === 'active' && props.viewerSide === null}>
      <GameWatchingFooter
        title={<Trans>You're watching</Trans>}
        detail={<Trans>Moves appear as they are played.</Trans>}
        dataSet={{ testid: 'game-session-watching' }}
      />
    </Show>
  );
}

/** How many people are watching, as the title row words it. */
export function frameWatchersLabel(count: number): string {
  return plural(count, {
    one: '# person watching',
    other: '# people watching',
  });
}

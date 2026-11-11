import { plural, t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { GameFact, GameFacts } from '@pkgs/ui-root-client-ts/game-facts';
import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import { GameWatchingFooter } from '@pkgs/ui-root-client-ts/game-watching';
import { WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { type JSX, Match, Show, Switch } from 'solid-js';
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

/** The agreed clock: minutes + added seconds. */
function TimeControlFact(props: { readonly status: FrameStatus }): JSX.Element {
  return (
    <GameFact
      label={
        <Show when={props.status.minutes > 0} fallback={<Trans>Untimed</Trans>}>
          {props.status.minutes}+{props.status.increment}
        </Show>
      }
    />
  );
}

/**
 * The game's facts for the title row, as one quiet line (`Unrated ·
 * Untimed`): settings, never pills that look pressable, in the same words
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
            testId="custom-game-unrated"
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
}): JSX.Element {
  return (
    <Show
      when={props.status}
      fallback={
        <VisuallyHidden
          role="status"
          aria-live="polite"
          testId="custom-game-status"
        >
          <Trans>No Custom Game.</Trans>
        </VisuallyHidden>
      }
    >
      {(status) => (
        <GameTurnPill
          live
          emphasis={status().emphasis}
          tone={status().tone}
          dataSet={{ testid: 'custom-game-status' }}
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
            props.arena === true &&
            status().tone === 'neutral' &&
            status().emphasis !== 'yours' &&
            !status().sending
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
}): JSX.Element {
  return (
    <Show when={props.connection !== 'online'}>
      <Notice
        tone={props.connection === 'needed' ? 'warning' : undefined}
        icon={WifiOffIcon}
        dataSet={{ testid: 'custom-game-connection-needed' }}
      >
        <Text variant="inherit" role="status">
          <Switch
            fallback={
              <Trans>
                You are offline. Moves and the dimmed commands come back when
                the connection returns.
              </Trans>
            }
          >
            <Match when={props.connection === 'waiting'}>
              <Trans>
                Your move will be played when the connection returns.
              </Trans>
            </Match>
            <Match when={props.connection === 'offline-local'}>
              <Trans>You are offline. Your local game can continue.</Trans>
            </Match>
          </Switch>
        </Text>
      </Notice>
    </Show>
  );
}

/** A refused choice, in words; nothing for none. */
export function FrameErrorView(props: { readonly text: string }): JSX.Element {
  return (
    <Show when={props.text !== ''}>
      <ErrorState
        variant="compact"
        title={t`That didn't go through`}
        body={props.text}
        dataSet={{ testid: 'custom-game-error' }}
      />
    </Show>
  );
}

/** What a participant is told during play: a draw offer, an absent opponent. */
export function FramePlayNoticesView(props: {
  readonly play: FramePlay;
  readonly people?: FramePeople | undefined;
}): JSX.Element {
  return (
    <>
      <Show when={props.play.drawOffered}>
        <Notice>
          <Text variant="inherit" role="status">
            <Trans>A draw has been offered.</Trans>
          </Text>
        </Notice>
      </Show>
      <Show when={props.play.away}>
        {(away) => (
          <StackVertical gap="md" testId="custom-game-away">
            <Notice>
              <Text variant="inherit" role="status">
                <FramePersonName
                  person={away().person}
                  plainName={away().plainName}
                  people={props.people}
                />{' '}
                <Show
                  when={away().twoSided}
                  fallback={
                    <Trans>
                      is away. Their turn stays reserved until they return.
                    </Trans>
                  }
                >
                  <Trans>
                    is away. After a minute away you may claim the win.
                  </Trans>
                </Show>
              </Text>
            </Notice>
          </StackVertical>
        )}
      </Show>
    </>
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
        dataSet={{ testid: 'custom-game-watching' }}
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

import { plural, t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { GameTurnPill } from '@pkgs/ui-root-client-ts/game-turn-pill';
import { GameWatchingFooter } from '@pkgs/ui-root-client-ts/game-watching';
import { WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
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

/** The agreed clock: minutes + added seconds. */
function TimeControlBadge(props: {
  readonly status: FrameStatus;
}): JSX.Element {
  return (
    <Badge
      intent="neutral"
      label={
        <Show when={props.status.minutes > 0} fallback={<Trans>Untimed</Trans>}>
          {props.status.minutes}+{props.status.increment}
        </Show>
      }
    />
  );
}

/**
 * Where the game stands, in one line: the eye reads the state beside the
 * seats; a listener, who cannot see the seats, first hears who holds them.
 * With no game yet only a listener hears it.
 */
export function FrameStatusView(props: {
  readonly status: FrameStatus | null;
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
              {status().description}
            </>
          }
          detail={status().sending ? <Trans>Sending choice…</Trans> : undefined}
          trailing={
            <StackHorizontal align="center" gap="sm">
              <Badge
                intent="neutral"
                label={<Trans>Unrated</Trans>}
                dataSet={{ testid: 'custom-game-unrated' }}
              />
              <TimeControlBadge status={status()} />
            </StackHorizontal>
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
        icon={WifiOffIcon}
        dataSet={{ testid: 'custom-game-connection-needed' }}
      >
        <Text variant="inherit" role="status">
          <Switch
            fallback={
              <Trans>Connection needed to change or play this game.</Trans>
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
      <Show when={props.play.offerAgainLater}>
        <P variant="caption" tone="secondary">
          <Trans>You may offer a draw again after your next move.</Trans>
        </P>
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

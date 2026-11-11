import type { LiveFrame } from '@libs/observatory-shared-ts/live-session';
import {
  OBSERVATORY_PATH,
  ONLINE_NOW_PATH,
} from '@libs/observatory-shared-ts/observatory-routes';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DeviceAvatar } from '@libs/profile-client-ts/device-avatar';
import { parseAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Badge, LiveBadge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { SlidersHorizontalIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { useRelativeTimeLabel } from '@pkgs/ui-root-client-ts/relative-time';
import { ScreenMirror } from '@pkgs/ui-root-client-ts/screen-mirror';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { useLiveLabels } from './live-labels';
import type { OnlineNowEntryView } from './observatory-api';
import { ObservatoryDenial } from './observatory-denial';

/** Where a live watch is. */
export type LiveWatchState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed' }
  | {
      readonly kind: 'watching';
      readonly entry: OnlineNowEntryView;
      readonly frame: LiveFrame | null;
    }
  | { readonly kind: 'offline'; readonly username: string | null };

export type LiveWatchScreenViewProps = {
  readonly state: LiveWatchState;
  /** Set when the person may not watch someone live; replaces the screen. */
  readonly denial?: DenialView | undefined;
  /** A Synthetic User being watched offers its control panel. */
  readonly canControl: boolean;
  readonly onControlPanel: (syntheticUserId: string) => void;
  /** Tries again after a failed read. */
  readonly onRetry: () => void;
  /** Back to the list of those online now. */
  readonly onBack: () => void;
};

/**
 * Who is being watched, compact above (or, on a desktop, beside) their
 * screen: their face and name over what they are doing, then a tag each
 * for a person or a Synthetic User, paused, and their place in the app; a
 * Synthetic User's control panel under them.
 */
function WatchedHeader(props: {
  entry: OnlineNowEntryView;
  canControl: boolean;
  onControlPanel: (syntheticUserId: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  const labels = useLiveLabels();
  return (
    <Surface tone="surface" radius="card" border padding="lg" gap="md">
      <StackHorizontal gap="md" align="center">
        <DeviceAvatar
          avatarConfig={parseAvatarConfig(props.entry.avatarConfig)}
          seedFallback={props.entry.accountId}
          name={props.entry.username}
          size={48}
        />
        <StackVertical gap="xs" grow shrink>
          <H2 size="subtitle">
            <Text variant="inherit" wrap="break" testId="live-watch-name">
              {props.entry.username || t`Unnamed`}
            </Text>
          </H2>
          <P variant="caption" testId="live-watch-activity">
            {labels.activity(props.entry)}
          </P>
        </StackVertical>
      </StackHorizontal>
      <StackHorizontal gap="xs" wrap>
        <Badge
          label={labels.kind(props.entry.kind)}
          intent="neutral"
          size="sm"
          dataSet={{ testid: 'live-watch-kind' }}
        />
        <Show when={props.entry.paused}>
          <Badge label={t`Paused`} intent="warning" size="sm" />
        </Show>
        <Badge
          label={labels.place(props.entry.place)}
          intent="neutral"
          size="sm"
          dataSet={{ testid: 'live-watch-place' }}
        />
      </StackHorizontal>
      <Show when={props.canControl ? props.entry.syntheticUserId : null}>
        {(id) => (
          <StackHorizontal>
            <Button
              title={t`Control panel`}
              intent="neutral"
              variant="outline"
              size="sm"
              icon={SlidersHorizontalIcon}
              onClick={() => props.onControlPanel(id())}
              dataSet={{ testid: 'live-watch-control-panel' }}
            />
          </StackHorizontal>
        )}
      </Show>
    </Surface>
  );
}

/** That their screen is live, and when its picture last changed. */
function LiveIndicator(props: { frame: LiveFrame }): JSX.Element {
  const { t } = useLingui();
  const updated = useRelativeTimeLabel(() =>
    new Date(props.frame.capturedAtMs).toISOString()
  );
  const caption = () => {
    const when = updated();
    return t`Updated ${when}`;
  };
  return (
    <StackHorizontal gap="sm" align="center" wrap>
      <LiveBadge />
      <P variant="caption">{caption()}</P>
    </StackHorizontal>
  );
}

/** Their screen as they see it, at their device's shape, once it arrives. */
function WatchedScreen(props: {
  entry: OnlineNowEntryView;
  frame: LiveFrame | null;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Show
      when={props.frame}
      fallback={
        <LoadingState
          variant="compact"
          caption={<Trans>Waiting for their screen…</Trans>}
        />
      }
    >
      {(frame) => (
        <StackVertical gap="sm">
          <LiveIndicator frame={frame()} />
          <ScreenMirror
            title={t`${props.entry.username}'s screen`}
            html={frame().html}
            dataSet={{ testid: 'live-watch-screen' }}
          />
        </StackVertical>
      )}
    </Show>
  );
}

function Watching(
  props: LiveWatchScreenViewProps & {
    entry: OnlineNowEntryView;
    frame: LiveFrame | null;
  }
): JSX.Element {
  return (
    <Grid columns={{ base: 1, lg: 2 }} gap="xl" align="start">
      <WatchedHeader
        entry={props.entry}
        canControl={props.canControl}
        onControlPanel={props.onControlPanel}
      />
      <WatchedScreen entry={props.entry} frame={props.frame} />
    </Grid>
  );
}

function LiveWatchBody(props: LiveWatchScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <Switch>
      <Match when={props.state.kind === 'loading'}>
        <LoadingState
          variant="compact"
          caption={<Trans>Opening their screen…</Trans>}
        />
      </Match>
      <Match when={props.state.kind === 'failed'}>
        <ErrorState
          variant="compact"
          title={<Trans>Their screen could not be shown.</Trans>}
          body={<Trans>Check your connection and try again.</Trans>}
          retry={{ onClick: () => props.onRetry() }}
        />
      </Match>
      <Match when={props.state.kind === 'watching' ? props.state : null} keyed>
        {(state) => (
          <Watching {...props} entry={state.entry} frame={state.frame} />
        )}
      </Match>
      <Match when={props.state.kind === 'offline' ? props.state : null} keyed>
        {(state) => (
          <EmptyState
            variant="compact"
            title={
              state.username === null
                ? t`They are no longer online now`
                : t`${state.username} is no longer online now`
            }
            body={t`Watching live stopped. Pick someone else who is online now.`}
            action={{
              label: t`Back to online now`,
              onClick: () => props.onBack(),
            }}
            dataSet={{ testid: 'live-watch-ended' }}
          />
        )}
      </Match>
    </Switch>
  );
}

/**
 * `/admin/observatory/live/:sessionId`, presentational: someone online now,
 * a person or a Synthetic User — who they are, what they are doing and
 * their place in the app in a compact header, then their screen as they
 * see it at their device's shape, marked live with when it last changed.
 * On a desktop the screen sits beside the header. Its waiting, loading,
 * failed, ended (no longer online now) and denied states.
 * `LiveWatchScreen` keeps the watch going.
 */
export function LiveWatchScreenView(
  props: LiveWatchScreenViewProps
): JSX.Element {
  return (
    <Show
      when={props.denial}
      fallback={
        <ContentScreen
          screenId="live-watch"
          width="list"
          breadcrumbs={[
            { name: <Trans>Profile</Trans>, href: '/profile' },
            { name: <Trans>Settings</Trans>, href: '/more' },
            {
              name: <Trans>User Observatory</Trans>,
              href: OBSERVATORY_PATH,
            },
            { name: <Trans>Online now</Trans>, href: ONLINE_NOW_PATH },
            { name: <Trans>Watch live</Trans> },
          ]}
        >
          <LiveWatchBody {...props} />
        </ContentScreen>
      }
    >
      {(denial) => <ObservatoryDenial denial={denial()} />}
    </Show>
  );
}

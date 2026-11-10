import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import type { LiveFrame } from '@libs/synthetic-population-shared-ts/live-session';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { ScreenMirror } from '@pkgs/ui-root-client-ts/screen-mirror';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { useLiveLabels } from './live-labels';
import type { OnlineNowEntryView } from './synthetic-population-api';
import { SyntheticPopulationDenial } from './synthetic-population-denial';

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

function WatchedHeader(props: {
  entry: OnlineNowEntryView;
  canControl: boolean;
  onControlPanel: (syntheticUserId: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  const labels = useLiveLabels();
  return (
    <MenuSection title={props.entry.username || t`Unnamed`}>
      <MenuRow
        title={<Trans>Who</Trans>}
        value={labels.kind(props.entry.kind)}
        dataSet={{ testid: 'live-watch-kind' }}
      />
      <MenuRow
        title={<Trans>Place in the app</Trans>}
        value={labels.place(props.entry.place)}
        dataSet={{ testid: 'live-watch-place' }}
      />
      <MenuRow
        title={<Trans>Doing</Trans>}
        value={labels.activity(props.entry)}
        valueLines={2}
        dataSet={{ testid: 'live-watch-activity' }}
      />
      <Show when={props.canControl ? props.entry.syntheticUserId : null}>
        {(id) => (
          <Button
            title={t`Control panel`}
            intent="neutral"
            variant="outline"
            onClick={() => props.onControlPanel(id())}
            dataSet={{ testid: 'live-watch-control-panel' }}
          />
        )}
      </Show>
    </MenuSection>
  );
}

function Watching(
  props: LiveWatchScreenViewProps & {
    entry: OnlineNowEntryView;
    frame: LiveFrame | null;
  }
): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <WatchedHeader
        entry={props.entry}
        canControl={props.canControl}
        onControlPanel={props.onControlPanel}
      />
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
          <ScreenMirror
            title={t`${props.entry.username}'s screen`}
            html={frame().html}
            dataSet={{ testid: 'live-watch-screen' }}
          />
        )}
      </Show>
    </>
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
 * `/admin/synthetic-population/live/:sessionId`, presentational: someone
 * online now, a person or a Synthetic User, with their place in the app,
 * what they are doing and their screen as they see it; its loading, failed,
 * ended (no longer online now) and denied states.
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
          breadcrumbs={[
            { name: <Trans>Settings</Trans>, href: '/more' },
            {
              name: <Trans>Bot Observatory</Trans>,
              href: '/admin/synthetic-population',
            },
            { name: <Trans>Watch live</Trans> },
          ]}
        >
          <LiveWatchBody {...props} />
        </ContentScreen>
      }
    >
      {(denial) => <SyntheticPopulationDenial denial={denial()} />}
    </Show>
  );
}

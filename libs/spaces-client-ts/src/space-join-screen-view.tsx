import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { Card } from '@pkgs/ui-root-client-ts/card';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { Gamepad2Icon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import type { MutationStateTransition } from '@pkgs/ui-root-client-ts/mutation-lifecycle';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import type { JSX } from 'solid-js';
import { Match, Show, Switch } from 'solid-js';
import type { SpaceCardData } from './space-card-view';
import { SpaceGuestsView, SpaceSummaryView } from './space-card-view';
import { SpaceHostOfflineNotice } from './space-connection-notice';
import { SpacesNeedConnectionNotice } from './spaces-notices';

/** What the viewer's device knows about a space it is not in (not ended). */
export type SpaceJoinStatus =
  | 'loading'
  | 'live'
  | 'unavailable'
  | 'missing'
  | 'offline';

/** The link to the space's host: up, still checking, or down on either side. */
export type SpaceJoinConnection =
  | 'ready'
  | 'loading'
  | 'offline'
  | 'host-offline';

export type SpaceJoinScreenViewProps = {
  /** Custom title, or the localized "<host>'s space" fallback. */
  readonly title: string;
  readonly status: SpaceJoinStatus;
  readonly connection: SpaceJoinConnection;
  /** Joining was tried without a connection, or the device is offline. */
  readonly needsConnection: boolean;
  /** The live space's summary card; null until it is read. */
  readonly space: SpaceCardData | null;
  /** The viewer is on the space's list and may leave it. */
  readonly canLeave: boolean;
  /** An earlier join was not confirmed; Join offers to check again. */
  readonly joinPending: boolean;
  readonly joinDisabled: boolean;
  /** Joins; the button shows joining / joined / failed in place. */
  readonly onJoin: () => Promise<void>;
  readonly onJoinPhaseChange?:
    | ((transition: MutationStateTransition) => void)
    | undefined;
  readonly onLeave: () => void;
  readonly onBackToSpaces: () => void;
};

function SpaceJoinButton(props: SpaceJoinScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const join = useMutationButton({
    operation: () => props.onJoin(),
    labels: {
      get idle() {
        return props.joinPending
          ? t`Not confirmed. Check again`
          : t`Join space`;
      },
      loading: t`Joining…`,
      success: t`Joined`,
      error: t`Couldn't join`,
    },
    get disabled() {
      return props.joinDisabled;
    },
    onPhaseChange: (transition) => props.onJoinPhaseChange?.(transition),
  });
  return (
    <Button
      {...join.buttonProps}
      flex={1}
      dataSet={{ testid: Handles.spaceJoin }}
    />
  );
}

/** Join, or — while the host is away — Leave for someone on its list. */
function JoinPromptFooter(props: SpaceJoinScreenViewProps): JSX.Element {
  return (
    <StackHorizontal>
      <Show
        when={props.connection === 'host-offline'}
        fallback={<SpaceJoinButton {...props} />}
      >
        <Show when={props.canLeave}>
          <Button
            title={<Trans>Leave space</Trans>}
            intent="neutral"
            variant="outline"
            flex={1}
            dataSet={{ testid: Handles.spaceLeave }}
            onClick={() => props.onLeave()}
          />
        </Show>
      </Show>
    </StackHorizontal>
  );
}

/** Live (not joined) preview: summary card and helper copy. */
function SpaceJoinLiveBody(props: {
  readonly space: SpaceCardData | null;
  readonly checkingHost: boolean;
}): JSX.Element {
  return (
    <StackVertical gap="lg">
      <Show when={props.space}>
        {(space) => (
          <Card>
            <SpaceSummaryView space={space()} />
            <SpaceGuestsView guests={space().guests} />
          </Card>
        )}
      </Show>
      <Show
        when={props.checkingHost}
        fallback={
          <P tone="secondary">
            <Trans>Join to see who is here and hang out.</Trans>
          </P>
        }
      >
        <LoadingState
          variant="compact"
          caption={<Trans>Checking the host’s connection…</Trans>}
        />
      </Show>
    </StackVertical>
  );
}

function JoinPromptBody(props: SpaceJoinScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const back = {
    label: t`Back to Spaces`,
    onClick: () => props.onBackToSpaces(),
  };
  return (
    <Switch>
      <Match when={props.status === 'loading'}>
        <LoadingState />
      </Match>
      <Match when={props.status === 'unavailable'}>
        <EmptyState
          icon={Gamepad2Icon}
          title={t`You can't join this space`}
          body={t`Only the host's friends and people the host adds can join it. Ask the host to add you, or check that the link is right.`}
          action={back}
        />
      </Match>
      <Match when={props.status === 'missing'}>
        <EmptyState
          icon={Gamepad2Icon}
          title={t`This space can't be found`}
          body={t`The link may be wrong, or the space may never have existed.`}
          action={back}
          dataSet={{ testid: Handles.spaceNotFound }}
        />
      </Match>
      <Match when={props.status === 'offline'}>
        <SpacesNeedConnectionNotice />
      </Match>
      <Match when={props.status === 'live'}>
        <SpaceJoinLiveBody
          space={props.space}
          checkingHost={props.connection === 'loading'}
        />
      </Match>
    </Switch>
  );
}

/**
 * `/space/:id` for a space the viewer is not in, presentational: a live
 * space's summary with Join, or why it cannot be joined (not allowed, not
 * found, offline, host away). `SpaceJoinPrompt` wires it to the space.
 */
export function SpaceJoinScreenView(
  props: SpaceJoinScreenViewProps
): JSX.Element {
  return (
    <ContentScreen
      screenId="space-join"
      dataSet={{ testid: Handles.spaceJoinPrompt }}
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: props.title },
      ]}
      footer={
        <Show when={props.status === 'live' && props.connection !== 'loading'}>
          <JoinPromptFooter {...props} />
        </Show>
      }
    >
      <StackVertical grow gap="md">
        <Show when={props.needsConnection && props.status !== 'offline'}>
          <SpacesNeedConnectionNotice />
        </Show>
        <Show
          when={props.status === 'live' && props.connection === 'host-offline'}
          fallback={<JoinPromptBody {...props} />}
        >
          <SpaceHostOfflineNotice />
        </Show>
      </StackVertical>
    </ContentScreen>
  );
}

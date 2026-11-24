import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { AvatarGroup } from '@pkgs/ui-root-client-ts/avatar-group';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { Card } from '@pkgs/ui-root-client-ts/card';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { Divider } from '@pkgs/ui-root-client-ts/divider';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { Gamepad2Icon, WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import type { MutationStateTransition } from '@pkgs/ui-root-client-ts/mutation-lifecycle';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import type { JSX } from 'solid-js';
import { Index, Match, Show, Switch } from 'solid-js';
import type { SpaceCardData } from './space-card-view';
import {
  SpaceBadgeView,
  SpaceGuestsPhrase,
  SpaceHostPhrase,
} from './space-card-view';
import { SpaceHostOfflineNotice } from './space-connection-notice';
import { SpaceMarkView } from './space-mark';
import type { SpacePerson } from './space-person-view';
import { SpacePersonAvatar } from './space-person-view';
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

/**
 * Join; while the host is away, the way back to Spaces instead, and Leave
 * for someone on the space's list.
 */
function JoinPromptFooter(props: SpaceJoinScreenViewProps): JSX.Element {
  return (
    <StackHorizontal gap="sm">
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
        <Button
          title={<Trans>Back to Spaces</Trans>}
          flex={1}
          onClick={() => props.onBackToSpaces()}
        />
      </Show>
    </StackHorizontal>
  );
}

const JOIN_FACE_SIZE = 32;
const JOIN_FACES_SHOWN = 6;

/** Who is in the space now: their faces, then who they are in words. */
function SpaceJoinWhoIsHere(props: {
  readonly guests: readonly SpacePerson[];
}): JSX.Element {
  const { t } = useLingui();
  const count = (): string => {
    const n = props.guests.length;
    return n === 1 ? t`1 person here` : t`${n} people here`;
  };
  return (
    <StackVertical gap="sm">
      <Text variant="sectionLabel" tone="secondary">
        <Show
          when={props.guests.length > 0}
          fallback={<Trans>No one else here yet</Trans>}
        >
          {count()}
        </Show>
      </Text>
      <Show when={props.guests.length > 0}>
        <StackHorizontal align="center" gap="sm">
          <AvatarGroup
            size={JOIN_FACE_SIZE}
            maxVisible={JOIN_FACES_SHOWN}
            ringColor="surface"
          >
            <Index each={props.guests}>
              {(guest) => (
                <SpacePersonAvatar person={guest()} size={JOIN_FACE_SIZE} />
              )}
            </Index>
          </AvatarGroup>
          <StackVertical grow shrink>
            <P variant="caption" lines={1}>
              <SpaceGuestsPhrase guests={props.guests} />
            </P>
          </StackVertical>
        </StackHorizontal>
      </Show>
    </StackVertical>
  );
}

/**
 * The invitation: the space's mark, name and host with its Live tag, then
 * who is in it, in one card, so a person sees what they are joining.
 */
function SpaceJoinInvitation(props: {
  readonly space: SpaceCardData;
}): JSX.Element {
  return (
    <Card>
      <StackVertical gap="lg">
        <StackHorizontal align="center" gap="md">
          <SpaceMarkView
            spaceId={props.space.spaceId}
            title={props.space.title}
            size="lg"
          />
          <StackVertical grow shrink gap="xs">
            <H2 size="subtitle" lines={2}>
              {props.space.title}
            </H2>
            <StackHorizontal align="center" gap="xs">
              <Show when={props.space.host} keyed>
                {(host) => <SpacePersonAvatar person={host} size={20} />}
              </Show>
              <StackVertical shrink>
                <P variant="caption" lines={1}>
                  <SpaceHostPhrase space={props.space} />
                </P>
              </StackVertical>
            </StackHorizontal>
          </StackVertical>
          <SpaceBadgeView badge={props.space.badge} />
        </StackHorizontal>
        <Divider />
        <SpaceJoinWhoIsHere guests={props.space.guests} />
      </StackVertical>
    </Card>
  );
}

/** Live (not joined): the invitation and what joining does. */
function SpaceJoinLiveBody(props: {
  readonly space: SpaceCardData | null;
  readonly checkingHost: boolean;
}): JSX.Element {
  return (
    <StackVertical gap="lg">
      <Show when={props.space}>
        {(space) => <SpaceJoinInvitation space={space()} />}
      </Show>
      <Show
        when={props.checkingHost}
        fallback={
          <P tone="secondary">
            <Trans>
              Join to play together. You'll go straight to whatever the space is
              doing.
            </Trans>
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
          body={t`Ask the host to send you the space's link or to add you, then try again.`}
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
        <EmptyState
          icon={WifiOffIcon}
          title={t`You're offline`}
          body={t`Joining someone's space needs a connection. Your own spaces still work offline.`}
          action={back}
          dataSet={{ testid: Handles.spacesNeedConnection }}
        />
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
          <StackVertical gap="lg">
            <SpaceHostOfflineNotice />
            <Show when={props.space}>
              {(space) => <SpaceJoinInvitation space={space()} />}
            </Show>
          </StackVertical>
        </Show>
      </StackVertical>
    </ContentScreen>
  );
}

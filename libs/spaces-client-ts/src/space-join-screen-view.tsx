import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { AvatarGroup } from '@pkgs/ui-root-client-ts/avatar-group';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Card } from '@pkgs/ui-root-client-ts/card';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import { Divider } from '@pkgs/ui-root-client-ts/divider';
import { H2 } from '@pkgs/ui-root-client-ts/heading';
import { Gamepad2Icon, WifiOffIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import type { MutationStateTransition } from '@pkgs/ui-root-client-ts/mutation-lifecycle';
import { NameText } from '@pkgs/ui-root-client-ts/name-text';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { ToastStack } from '@pkgs/ui-root-client-ts/toast-stack';
import type { JSX } from '@solidjs/web';
import { For, Match, Show, Switch } from 'solid-js';
import type { SpaceCardData } from './space-card-view';
import {
  SpaceBadgeView,
  SpaceHostPhrase,
  spaceCardOthers,
} from './space-card-view';
import { SpaceHostOfflineNotice } from './space-connection-notice';
import { SpaceJoinFooter, SpaceJoinRecoveryActions } from './space-join-footer';
import { SpaceMarkView } from './space-mark';
import type { SpacePerson } from './space-person-view';
import { SpacePersonAvatar } from './space-person-view';
import { SpaceRecoveryState } from './space-recovery-state';
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
  /**
   * Custom title, or the localized "<host>'s space" fallback; null while
   * the device knows neither, so the page names what it is doing instead.
   */
  readonly title: string | null;
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
  /** Offline: asks the server again; rejects while still offline. */
  readonly onRetry: () => Promise<void>;
};

/**
 * Who is here in words, on one line: the first name (the viewer's "You"
 * first) ends in an ellipsis on its own, so "and 6 others" always shows.
 */
function JoinGuestsLine(props: {
  readonly guests: readonly SpacePerson[];
  readonly viewerId?: string | undefined;
}): JSX.Element {
  const { t } = useLingui();
  const ordered = (): readonly SpacePerson[] => {
    const you = props.guests.find((guest) => guest.id === props.viewerId);
    return you === undefined
      ? props.guests
      : [you, ...props.guests.filter((guest) => guest !== you)];
  };
  const nameOf = (person: SpacePerson | undefined): string => {
    if (person === undefined) return '';
    if (person.id === props.viewerId) return t`You`;
    return person.name.trim() === '' ? t`Guest` : person.name;
  };
  const rest = (): string => {
    const list = ordered();
    if (list.length === 2) return t`and 1 other`;
    if (list.length > 2) return t`and ${list.length - 1} others`;
    return '';
  };
  // One sentence over up to two lines: a long name wraps, so the guest
  // reads who is here and the count always shows.
  return (
    <P variant="caption" lines={2} testId="space-join-guests">
      <NameText name={nameOf(ordered()[0])} />
      <Show when={rest() !== ''}> {rest()}</Show>
    </P>
  );
}

const JOIN_FACE_SIZE = 32;
const JOIN_FACES_SHOWN = 5;

/** Who is in the space now: their faces, then who they are in words. */
function SpaceJoinWhoIsHere(props: {
  readonly guests: readonly SpacePerson[];
  readonly viewerId?: string | undefined;
  /** The host is away: who was here is the last word, not live. */
  readonly lastKnown: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const count = (): string => {
    const n = props.guests.length;
    if (props.lastKnown)
      return n === 1 ? t`1 person was here` : t`${n} people were here`;
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
        {/* The faces, then the names on a line of their own, so the person
            named is never cut by the stack beside them. */}
        <StackVertical gap="sm">
          <AvatarGroup
            size={JOIN_FACE_SIZE}
            maxVisible={JOIN_FACES_SHOWN}
            ringColor="surface"
          >
            <For keyed={false} each={props.guests}>
              {(guest) => (
                <SpacePersonAvatar person={guest()} size={JOIN_FACE_SIZE} />
              )}
            </For>
          </AvatarGroup>
          <JoinGuestsLine guests={props.guests} viewerId={props.viewerId} />
        </StackVertical>
      </Show>
    </StackVertical>
  );
}

/**
 * The invitation: the space's mark, name and host with its Live tag, then
 * who is in it, in one card, so a person sees what they are joining.
 */
/** How the host's side stands, as the invitation tags it. */
type SpaceJoinHost = 'ready' | 'checking' | 'offline' | 'unknown';

/** The invitation's tag: Live once the host is reachable, else why not. */
function SpaceJoinStatusTag(props: {
  readonly space: SpaceCardData;
  readonly host: SpaceJoinHost;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.host === 'ready'}>
        <SpaceBadgeView badge={props.space.badge} />
      </Match>
      <Match when={props.host === 'offline'}>
        <Badge
          label={<Trans>Host offline</Trans>}
          intent="neutral"
          dataSet={{ testid: Handles.spaceJoinHostOfflineTag }}
        />
      </Match>
    </Switch>
  );
}

function SpaceJoinInvitation(props: {
  readonly space: SpaceCardData;
  readonly host: SpaceJoinHost;
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
          <StackHorizontal grow shrink align="start" gap="sm">
            <StackVertical grow shrink>
              <H2 size="subtitle">{props.space.title}</H2>
            </StackVertical>
            <StackHorizontal align="center">
              <SpaceJoinStatusTag space={props.space} host={props.host} />
            </StackHorizontal>
          </StackHorizontal>
        </StackHorizontal>
        {/* Who hosts, on a row of the card's full width: a long name wraps
            at its separators over two lines, so the guest confirms whose
            space it is; the full name is its title. */}
        <StackHorizontal align="start" gap="xs">
          <Show when={props.space.host} keyed>
            {(host) => <SpacePersonAvatar person={host} size={20} />}
          </Show>
          <StackVertical grow shrink>
            <P variant="caption" lines={2}>
              <SpaceHostPhrase space={props.space} />
            </P>
          </StackVertical>
        </StackHorizontal>
        <Divider />
        {/* Before joining, who is here means the others: the viewer is
            neither counted nor named until they are in. */}
        <SpaceJoinWhoIsHere
          guests={spaceCardOthers(props.space)}
          lastKnown={props.host === 'offline' || props.host === 'unknown'}
        />
      </StackVertical>
    </Card>
  );
}

/**
 * Without a connection nothing about the space is current: no Live tag,
 * and who was there is the last word.
 */
function joinHostState(props: {
  readonly checkingHost: boolean;
  readonly needsConnection: boolean;
}): SpaceJoinHost {
  if (props.needsConnection) return 'unknown';
  return props.checkingHost ? 'checking' : 'ready';
}

/** Live (not joined): the invitation and what joining does. */
function SpaceJoinLiveBody(props: {
  readonly space: SpaceCardData | null;
  readonly checkingHost: boolean;
  readonly needsConnection: boolean;
  /** An earlier join was not confirmed: the notice and its button say so. */
  readonly joinPending: boolean;
}): JSX.Element {
  return (
    <StackVertical gap="lg">
      <Show when={props.space}>
        {(space) => (
          <SpaceJoinInvitation space={space()} host={joinHostState(props)} />
        )}
      </Show>
      <Show
        when={props.checkingHost}
        fallback={
          // Needing the connection is said once, in the alert that stays
          // while it lasts, and a join not confirmed in the notice and its
          // button; what joining does is said only when joining can happen.
          <Show when={!props.joinPending && !props.needsConnection}>
            <P tone="secondary">
              <Trans>
                Join to play together. You'll go straight to whatever the space
                is doing.
              </Trans>
            </P>
          </Show>
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

/** A state that cannot join (or is still opening), in words. */
type JoinRecoveryCopy = {
  readonly title: string;
  readonly body?: string | undefined;
  readonly icon?: IconComponent | undefined;
  readonly testId?: string | undefined;
};

/**
 * What a state that is not the live invitation says: its title is the
 * screen's one heading, drawn with the message rather than in the header,
 * so every sibling state reads alike and never says its words twice.
 */
function useJoinRecoveryCopy(): (status: SpaceJoinStatus) => JoinRecoveryCopy {
  const { t } = useLingui();
  return (status) => {
    if (status === 'loading') return { title: t`Opening the space…` };
    if (status === 'unavailable')
      return {
        title: t`You can't join this space`,
        body: t`Ask the host to add you or send you the link. If they add you, look under Shared with you in Spaces.`,
        icon: Gamepad2Icon,
        testId: Handles.spaceJoinUnavailable,
      };
    if (status === 'missing')
      return {
        title: t`This space can't be found`,
        body: t`The link may be wrong, or the space may never have existed.`,
        icon: Gamepad2Icon,
        testId: Handles.spaceNotFound,
      };
    return {
      title: t`You're offline`,
      body: t`Joining someone else's space needs a connection. Your own spaces still work offline.`,
      icon: WifiOffIcon,
      testId: Handles.spacesNeedConnection,
    };
  };
}

function JoinPromptBody(props: SpaceJoinScreenViewProps): JSX.Element {
  const recovery = useJoinRecoveryCopy();
  const copy = () => recovery(props.status);
  return (
    <Show
      when={props.status === 'live'}
      fallback={
        <SpaceRecoveryState
          title={copy().title}
          body={copy().body}
          icon={copy().icon}
          testId={copy().testId}
          role={props.status === 'loading' ? 'status' : undefined}
        >
          <SpaceJoinRecoveryActions {...props} />
        </SpaceRecoveryState>
      }
    >
      <SpaceJoinLiveBody
        space={props.space}
        checkingHost={props.connection === 'loading'}
        needsConnection={props.needsConnection}
        joinPending={props.joinPending}
      />
    </Show>
  );
}

/**
 * The page's title. With the invitation card on screen the card names the
 * space, so the header says what the page is for ("Join space"), never the
 * name twice. Every other state draws its title with its message (see
 * `useJoinRecoveryCopy`).
 */
function useSpaceJoinPageTitle(
  props: SpaceJoinScreenViewProps
): () => JSX.Element {
  const copy = useJoinRecoveryCopy();
  return () => {
    if (props.status !== 'live') return copy(props.status).title;
    if (props.space === null) return props.title ?? <Trans>Join space</Trans>;
    return props.joinPending ? (
      <Trans>Check your join</Trans>
    ) : (
      <Trans>Join space</Trans>
    );
  };
}

/**
 * `/space/:id` for a space the viewer is not in, presentational: a live
 * space's summary with Join, or why it cannot be joined (not allowed, not
 * found, offline, host away). `SpaceJoinPrompt` wires it to the space.
 */
export function SpaceJoinScreenView(
  props: SpaceJoinScreenViewProps
): JSX.Element {
  const pageTitle = useSpaceJoinPageTitle(props);
  return (
    <ContentScreen
      screenId="space-join"
      dataSet={{ testid: Handles.spaceJoinPrompt }}
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: pageTitle() },
      ]}
      width={props.status === 'live' ? 'prose' : 'full'}
      titlePlacement={props.status === 'live' ? 'header' : 'content'}
      footer={
        props.status === 'live' ? <SpaceJoinFooter {...props} /> : undefined
      }
    >
      <StackVertical grow gap="md">
        {/* What comes and goes (no connection, a join not confirmed, the
            host away) floats over the screen, never a row in it. */}
        <ToastStack persistent>
          <Show when={props.status === 'live' && props.joinPending}>
            <Notice
              tone="warning"
              dataSet={{ testid: Handles.spaceJoinNotConfirmed }}
            >
              <Trans>
                We haven't heard back about your join. Check if you're in.
              </Trans>
            </Notice>
          </Show>
          <Show when={props.needsConnection && props.status !== 'offline'}>
            <SpacesNeedConnectionNotice />
          </Show>
          <Show
            when={
              props.status === 'live' && props.connection === 'host-offline'
            }
          >
            <SpaceHostOfflineNotice />
          </Show>
        </ToastStack>
        <Show
          when={props.status === 'live' && props.connection === 'host-offline'}
          fallback={<JoinPromptBody {...props} />}
        >
          <StackVertical gap="lg">
            <Show when={props.space}>
              {(space) => (
                <SpaceJoinInvitation space={space()} host="offline" />
              )}
            </Show>
          </StackVertical>
        </Show>
      </StackVertical>
    </ContentScreen>
  );
}

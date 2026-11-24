import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { AvatarGroup } from '@pkgs/ui-root-client-ts/avatar-group';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
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
import { ToastStack } from '@pkgs/ui-root-client-ts/toast-stack';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import type { JSX } from 'solid-js';
import { Index, Match, Show, Switch } from 'solid-js';
import type { SpaceCardData } from './space-card-view';
import {
  SpaceBadgeView,
  SpaceHostPhrase,
  spaceCardOthers,
} from './space-card-view';
import { SpaceHostOfflineNotice } from './space-connection-notice';
import { SpaceMarkView } from './space-mark';
import type { SpacePerson } from './space-person-view';
import { SpacePersonAvatar } from './space-person-view';
import { SpaceRecoveryBar } from './space-recovery-bar';
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
        if (props.joinPending) return t`Check again`;
        return props.needsConnection ? t`Try joining again` : t`Join space`;
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
      // Offline, the way back leads and trying again waits beside it; once
      // the connection returns, joining is the filled command again.
      {...(props.needsConnection
        ? { variant: 'outline' as const, intent: 'neutral' as const }
        : {})}
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
        fallback={
          // Back to Spaces on the left, joining on the right, in every
          // state; needing the connection, the way back is the filled one.
          <Show
            when={props.needsConnection}
            fallback={
              <>
                {/* An unconfirmed join keeps a way back beside it. */}
                <Show when={props.joinPending}>
                  <Button
                    title={<Trans>Back to Spaces</Trans>}
                    intent="neutral"
                    variant="outline"
                    flex={1}
                    onClick={() => props.onBackToSpaces()}
                  />
                </Show>
                <SpaceJoinButton {...props} />
              </>
            }
          >
            {/* The way back always on the left and trying again on the
                right, as on every recovery pair; the fill says which fits
                now. */}
            <Button
              title={<Trans>Back to Spaces</Trans>}
              flex={1}
              onClick={() => props.onBackToSpaces()}
            />
            <SpaceJoinButton {...props} />
          </Show>
        }
      >
        {/* Back to Spaces on the left, as on every Join state. */}
        <Button
          title={<Trans>Back to Spaces</Trans>}
          flex={1}
          onClick={() => props.onBackToSpaces()}
        />
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
      {nameOf(ordered()[0])}
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
            <Index each={props.guests}>
              {(guest) => (
                <SpacePersonAvatar person={guest()} size={JOIN_FACE_SIZE} />
              )}
            </Index>
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
          <StackVertical grow shrink gap="xs">
            {/* In full: the guest confirms which space they are joining. */}
            <H2 size="subtitle">{props.space.title}</H2>
          </StackVertical>
          <SpaceJoinStatusTag space={props.space} host={props.host} />
        </StackHorizontal>
        {/* Who hosts, on a row of the card's full width: a long name wraps
            to its last character, so the guest confirms whose space it is. */}
        <StackHorizontal align="start" gap="xs">
          <Show when={props.space.host} keyed>
            {(host) => <SpacePersonAvatar person={host} size={20} />}
          </Show>
          <StackVertical grow shrink>
            <P variant="caption" lines={6}>
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
  /** An earlier join was not confirmed: the page says so by Check again. */
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
          <P tone="secondary">
            <Show
              when={!props.joinPending}
              fallback={
                <Text variant="inherit" testId={Handles.spaceJoinNotConfirmed}>
                  <Trans>
                    Your join isn't confirmed yet. Check again to see whether
                    you're in.
                  </Trans>
                </Text>
              }
            >
              {/* Needing the connection is said once, in the alert that
                  stays while it lasts; the page still says what joining
                  does. */}
              <Trans>
                Join to play together. You'll go straight to whatever the space
                is doing.
              </Trans>
            </Show>
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
  return (
    <Switch>
      <Match when={props.status === 'loading'}>
        <LoadingState caption={t`Opening the space…`} />
      </Match>
      <Match when={props.status === 'unavailable'}>
        <EmptyState
          icon={Gamepad2Icon}
          title={t`You can't join this space`}
          body={t`Ask the host to add you or send you the link. If they add you, look under Shared with you in Spaces.`}
        />
      </Match>
      <Match when={props.status === 'missing'}>
        <EmptyState
          icon={Gamepad2Icon}
          title={t`This space can't be found`}
          body={t`The link may be wrong, or the space may never have existed.`}
          dataSet={{ testid: Handles.spaceNotFound }}
        />
      </Match>
      <Match when={props.status === 'offline'}>
        <EmptyState
          icon={WifiOffIcon}
          title={t`You're offline`}
          body={t`Joining someone else's space needs a connection. Your own spaces still work offline.`}
          dataSet={{ testid: Handles.spacesNeedConnection }}
        />
      </Match>
      <Match when={props.status === 'live'}>
        <SpaceJoinLiveBody
          space={props.space}
          checkingHost={props.connection === 'loading'}
          needsConnection={props.needsConnection}
          joinPending={props.joinPending}
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
        <Switch>
          <Match
            when={props.status === 'live' && props.connection !== 'loading'}
          >
            <JoinPromptFooter {...props} />
          </Match>
          {/* While the host's connection is checked, the way back waits
              in the bar, as in every other state. */}
          <Match
            when={props.status === 'live' && props.connection === 'loading'}
          >
            <Button
              title={<Trans>Back to Spaces</Trans>}
              intent="neutral"
              variant="outline"
              fullWidth
              onClick={() => props.onBackToSpaces()}
            />
          </Match>
          {/* Every state that cannot join keeps the same bottom bar, with
              its one way on filled. */}
          <Match
            when={
              props.status === 'unavailable' ||
              props.status === 'missing' ||
              props.status === 'offline'
            }
          >
            <SpaceRecoveryBar>
              <Button
                title={<Trans>Back to Spaces</Trans>}
                fullWidth
                onClick={() => props.onBackToSpaces()}
                // The addresses its empty state's action had.
                dataSet={
                  props.status === 'missing'
                    ? { testid: Handles.spaceNotFoundBack }
                    : props.status === 'offline'
                      ? { testid: `${Handles.spacesNeedConnection}-action` }
                      : undefined
                }
              />
            </SpaceRecoveryBar>
          </Match>
        </Switch>
      }
    >
      <StackVertical grow gap="md">
        {/* What comes and goes (no connection, a join not confirmed, the
            host away) floats over the screen, never a row in it. */}
        <ToastStack persistent>
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

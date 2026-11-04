import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { AvatarGroup } from '@pkgs/ui-root-client-ts/avatar-group';
import { Badge, LiveBadge } from '@pkgs/ui-root-client-ts/badge';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { Index, Match, Show, Switch } from 'solid-js';
import type { SpacePerson } from './space-person-view';
import { SpacePersonAvatar, SpacePersonName } from './space-person-view';

/** The status tag on a space: open on this device, live, or none (ended). */
export type SpaceCardBadge = 'current' | 'live' | 'none';

/** What a space card shows about one space. */
export type SpaceCardData = {
  readonly spaceId: string;
  /** Custom title, or the localized "<host>'s space" fallback. */
  readonly title: string;
  readonly host: SpacePerson | null;
  /** The host's stored username, for the card's test handle. */
  readonly hostUsername: string | null;
  readonly badge: SpaceCardBadge;
  /** The viewer is in this space, so opening it returns to it. */
  readonly active: boolean;
  /** Guests seated in the space's room, host excluded. */
  readonly guests: readonly SpacePerson[];
};

const HOST_AVATAR_SIZE = 44;
const GUEST_AVATAR_SIZE = 24;
const GUEST_AVATAR_MAX_VISIBLE = 6;
/** Names spelled out under the faces; the rest are counted. */
const GUEST_NAMES_SHOWN = 3;

/** "Current" when this device has the space open, otherwise LIVE. */
export function SpaceBadgeView(props: {
  readonly badge: SpaceCardBadge;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.badge === 'current'}>
        <Badge label={<Trans>Current</Trans>} intent="brand" tone="solid" />
      </Match>
      <Match when={props.badge === 'live'}>
        <LiveBadge />
      </Match>
    </Switch>
  );
}

/** Host face, title and host name, with the space's status tag. */
export function SpaceSummaryView(props: {
  readonly space: SpaceCardData;
}): JSX.Element {
  return (
    <StackHorizontal justify="between" gap="sm">
      <StackHorizontal grow align="center" gap="sm">
        <SpacePersonAvatar
          person={props.space.host}
          size={HOST_AVATAR_SIZE}
          vividBackdrop
        />
        <StackVertical grow>
          <Text variant="bodyBold" lines={1}>
            {props.space.title}
          </Text>
          <SpacePersonName
            person={props.space.host}
            variant="caption"
            lines={1}
          />
        </StackVertical>
      </StackHorizontal>
      <SpaceBadgeView badge={props.space.badge} />
    </StackHorizontal>
  );
}

/**
 * The first few guests by name on one line, then how many more: a long name
 * ends in an ellipsis, and the count always shows after it.
 */
function SpaceGuestNames(props: {
  readonly guests: readonly SpacePerson[];
}): JSX.Element {
  const { t } = useLingui();
  const named = (): readonly SpacePerson[] =>
    props.guests.slice(0, GUEST_NAMES_SHOWN);
  const more = (): number =>
    Math.max(0, props.guests.length - GUEST_NAMES_SHOWN);
  return (
    <StackHorizontal align="center" gap="xs">
      <StackVertical shrink>
        <P variant="caption" lines={1}>
          <Index each={named()}>
            {(guest, index) => (
              <>
                {index > 0 ? ', ' : null}
                <SpacePersonName person={guest()} variant="caption" />
              </>
            )}
          </Index>
        </P>
      </StackVertical>
      <Show when={more() > 0}>
        <StackVertical>
          <P variant="caption">{t`+${more()} more`}</P>
        </StackVertical>
      </Show>
    </StackHorizontal>
  );
}

/**
 * Count line, avatar stack and the first guests' names for a space's
 * guests. Renders nothing when the space has no guests — no placeholder, no
 * spacer.
 */
export function SpaceGuestsView(props: {
  readonly guests: readonly SpacePerson[];
}): JSX.Element {
  const { t } = useLingui();
  const count = (): string => {
    const n = props.guests.length;
    return n === 1 ? t`1 guest` : t`${n} guests`;
  };
  return (
    <Show when={props.guests.length > 0}>
      <StackVertical gap="sm">
        <P variant="caption">{count()}</P>
        <AvatarGroup
          size={GUEST_AVATAR_SIZE}
          maxVisible={GUEST_AVATAR_MAX_VISIBLE}
          ringColor="surface"
        >
          <Index each={props.guests}>
            {(guest) => (
              <SpacePersonAvatar person={guest()} size={GUEST_AVATAR_SIZE} />
            )}
          </Index>
        </AvatarGroup>
        <SpaceGuestNames guests={props.guests} />
      </StackVertical>
    </Show>
  );
}

/** One row in the lobby panel; pressing it opens the space. */
export function SpaceCardView(props: {
  readonly space: SpaceCardData;
  readonly onOpen: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const label = (): string =>
    props.space.active
      ? t`Open current space ${props.space.title}`
      : t`Open space ${props.space.title}`;
  const testId = (): string | undefined => {
    const host = props.space.hostUsername;
    return host !== null ? Handles.spaceCard(host) : undefined;
  };
  return (
    <Pressable
      width="full"
      testId={testId()}
      onPress={() => props.onOpen()}
      aria-label={label()}
    >
      <StackVertical
        padding="lg"
        gap="md"
        testId={Handles.spaceLobbyCard(props.space.spaceId)}
      >
        <SpaceSummaryView space={props.space} />
        <SpaceGuestsView guests={props.space.guests} />
      </StackVertical>
    </Pressable>
  );
}

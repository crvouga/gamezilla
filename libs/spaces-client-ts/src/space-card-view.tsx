import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { AvatarGroup } from '@pkgs/ui-root-client-ts/avatar-group';
import { CurrentBadge, LiveBadge } from '@pkgs/ui-root-client-ts/badge';
import { ChevronRightIcon } from '@pkgs/ui-root-client-ts/icons';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { Index, Match, Show, Switch } from 'solid-js';
import { SpaceMarkView } from './space-mark';
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
  /** The viewer hosts this space, so the lobby lists it under their own. */
  readonly hostedByViewer: boolean;
  /** Guests seated in the space's room, host excluded. */
  readonly guests: readonly SpacePerson[];
};

const GUEST_AVATAR_SIZE = 24;
const GUEST_AVATAR_MAX_VISIBLE = 6;
/** Names spelled out under the faces; the rest are counted. */
const GUEST_NAMES_SHOWN = 3;
const ACTION_ICON_SIZE = 16;

/**
 * "Current" when this device has the space open, otherwise "Live": one tag
 * shape, two tones.
 */
export function SpaceBadgeView(props: {
  readonly badge: SpaceCardBadge;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.badge === 'current'}>
        <CurrentBadge />
      </Match>
      <Match when={props.badge === 'live'}>
        <LiveBadge />
      </Match>
    </Switch>
  );
}

/** The space's mark, title and host name, with the space's status tag. */
export function SpaceSummaryView(props: {
  readonly space: SpaceCardData;
}): JSX.Element {
  return (
    <StackHorizontal justify="between" gap="sm">
      <StackHorizontal grow align="center" gap="sm">
        <SpaceMarkView
          spaceId={props.space.spaceId}
          title={props.space.title}
          size="lg"
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
  /** Names spelled out before the count. Default three. */
  readonly shown?: number | undefined;
}): JSX.Element {
  const { t } = useLingui();
  const shown = (): number => props.shown ?? GUEST_NAMES_SHOWN;
  const named = (): readonly SpacePerson[] => props.guests.slice(0, shown());
  const more = (): number => Math.max(0, props.guests.length - shown());
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

/** What pressing a lobby card does: go back in, open your own, or join. */
export type SpaceCardAction = 'resume' | 'open' | 'join';

/** "Resume" where the viewer already is, "Open" for their own, else "Join". */
export function spaceCardAction(space: SpaceCardData): SpaceCardAction {
  if (space.active) return 'resume';
  return space.hostedByViewer ? 'open' : 'join';
}

/** Who hosts the space: "Hosted by you", or the host's name. */
export function SpaceHostPhrase(props: {
  readonly space: SpaceCardData;
}): JSX.Element {
  return (
    <Show
      when={!props.space.hostedByViewer}
      fallback={<Trans>Hosted by you</Trans>}
    >
      <Show when={props.space.host} keyed>
        {(host) => (
          <Trans>
            Hosted by <SpacePersonName person={host} variant="caption" />
          </Trans>
        )}
      </Show>
    </Show>
  );
}

/**
 * Who else is in the space, in words that never break mid-list: "No guests
 * yet", one or two names, or the first name and how many others
 * ("avery and 6 others"). A long name ends the line in an ellipsis; the
 * count is part of the sentence, never a separate "+5 more".
 */
export function SpaceGuestsPhrase(props: {
  readonly guests: readonly SpacePerson[];
}): JSX.Element {
  const first = (): SpacePerson | undefined => props.guests[0];
  const second = (): SpacePerson | undefined => props.guests[1];
  const others = (): number => Math.max(0, props.guests.length - 1);
  return (
    <Switch fallback={<Trans>No guests yet</Trans>}>
      <Match when={props.guests.length === 1 && first()} keyed>
        {(guest) => <SpacePersonName person={guest} variant="caption" />}
      </Match>
      <Match when={props.guests.length === 2 && first()} keyed>
        {(guest) => (
          <Trans>
            <SpacePersonName person={guest} variant="caption" /> and{' '}
            <SpacePersonName person={second() ?? guest} variant="caption" />
          </Trans>
        )}
      </Match>
      <Match when={props.guests.length > 2 && first()} keyed>
        {(guest) => (
          <Trans>
            <SpacePersonName person={guest} variant="caption" /> and {others()}{' '}
            others
          </Trans>
        )}
      </Match>
    </Switch>
  );
}

/**
 * Everything under the card's title on one line: who hosts it, then who
 * else is in it ("Hosted by sam · avery and 6 others"). One sentence, so a
 * narrow card ends it in one ellipsis instead of breaking the list.
 */
function SpaceCardMetaLine(props: {
  readonly space: SpaceCardData;
}): JSX.Element {
  return (
    <P variant="caption" lines={1}>
      <SpaceHostPhrase space={props.space} />
      {' · '}
      <SpaceGuestsPhrase guests={props.space.guests} />
    </P>
  );
}

/**
 * The card's trailing word for what a press does, with a chevron: it names
 * the card's one action. The whole card is the control, so this is a label,
 * not a second button.
 */
export function SpaceCardActionLabel(props: {
  readonly action: SpaceCardAction;
}): JSX.Element {
  return (
    <StackHorizontal align="center" gap="xs">
      {/* Medium, like the title: the verb never outweighs the space it opens. */}
      <Text variant="rowTitle" tone="tint">
        <Switch>
          <Match when={props.action === 'resume'}>
            <Trans>Resume</Trans>
          </Match>
          <Match when={props.action === 'open'}>
            <Trans>Open</Trans>
          </Match>
          <Match when={props.action === 'join'}>
            <Trans>Join</Trans>
          </Match>
        </Switch>
      </Text>
      <ChevronRightIcon size={ACTION_ICON_SIZE} color="tint" />
    </StackHorizontal>
  );
}

/** What pressing a space's card says it does, for assistive tech. */
export function useSpaceCardLabel(space: () => SpaceCardData): () => string {
  const { t } = useLingui();
  return () => {
    const action = spaceCardAction(space());
    if (action === 'resume') return t`Resume space ${space().title}`;
    if (action === 'open') return t`Open space ${space().title}`;
    return t`Join space ${space().title}`;
  };
}

/** The card's handle: by its host's username, once that is known. */
export function spaceCardTestId(space: SpaceCardData): string | undefined {
  const host = space.hostUsername;
  return host !== null ? Handles.spaceCard(host) : undefined;
}

/**
 * One row in the lobby panel, in one anatomy for every space: the space's
 * own mark; the name, with what pressing it does at the end of the name's line,
 * over one full-width line of who hosts it and who else is in it. The
 * action is Resume where the
 * viewer already is, Open for their own, Join for someone else's. Every
 * space listed is live, so the row names the next step instead of tagging
 * it "Live", and says "Resume" once instead of tagging it "Current" too.
 * Pressing anywhere on the row does that.
 */
export function SpaceCardView(props: {
  readonly space: SpaceCardData;
  readonly onOpen: () => void;
}): JSX.Element {
  const label = useSpaceCardLabel(() => props.space);
  const testId = (): string | undefined => spaceCardTestId(props.space);
  return (
    <Pressable
      width="full"
      testId={testId()}
      onPress={() => props.onOpen()}
      aria-label={label()}
    >
      <StackHorizontal
        padding="lg"
        gap="md"
        align="center"
        testId={Handles.spaceLobbyCard(props.space.spaceId)}
      >
        <SpaceMarkView
          spaceId={props.space.spaceId}
          title={props.space.title}
        />
        <StackVertical grow shrink gap="xs">
          {/* The action shares the title's line, so the line under it can
              run the card's full width and still name who is in it. */}
          <StackHorizontal align="center" justify="between" gap="sm">
            <StackVertical shrink>
              {/* The list-row title: medium, as in every panel of rows. */}
              <Text variant="rowTitle" lines={1}>
                {props.space.title}
              </Text>
            </StackVertical>
            <SpaceCardActionLabel action={spaceCardAction(props.space)} />
          </StackHorizontal>
          <SpaceCardMetaLine space={props.space} />
        </StackVertical>
      </StackHorizontal>
    </Pressable>
  );
}

import { DeviceAvatar } from '@libs/profile-client-ts/device-avatar';
import {
  parseAvatarConfig,
  serializeDefaultAvatarConfig,
} from '@libs/profile-shared-ts/avatar-config';
import type { UserSearchResult } from '@libs/user-search-shared-ts/user-search-types';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  HighlightedText,
  rangesOfMatch,
} from '@pkgs/ui-root-client-ts/highlighted-text';
import { CheckIcon, UserPlusIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuList } from '@pkgs/ui-root-client-ts/menu-list';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { createSignal, For, type JSX, Match, Show, Switch } from 'solid-js';

/**
 * Story fixture: a person found by search, with the default face every
 * profile is seeded with (`synced: false` for one whose profile has not
 * reached this device, which shows their initials). The id is the one the
 * space fixtures (`spaces-story.example.tsx`) give the same person, so they
 * wear the same face in every story.
 */
export function storyResult(
  suffix: string,
  username: string,
  options: { readonly synced?: boolean } = {}
): UserSearchResult {
  const userId = `5a1e0000-0000-4000-8000-0000000000${suffix}`;
  return {
    userId,
    username,
    avatarConfig:
      options.synced === false ? null : serializeDefaultAvatarConfig(userId),
  };
}

type StoryRelation = 'add' | 'friends' | 'requested' | 'incoming';

/**
 * How a stand-in row relates the viewer (avery) to a person, by username:
 * jordan_plays is a friend, jordan asked to be friends, a request to jordy
 * is out, and the rest are strangers.
 */
const STORY_RELATIONS: Readonly<Record<string, StoryRelation>> = {
  jordan: 'incoming',
  jordan_plays: 'friends',
  jordy: 'requested',
};

/**
 * Stand-in for the friends sub's relationship: the row's controls, every
 * one ending on the same edge: "Friends" as words with a check in the
 * success ink (a status, not a control), "Cancel request" for one that is
 * out and "Add friend" as the same small outlined pill, and Accept /
 * Decline for one who asked (the words the app uses everywhere).
 */
function StoryRelationPill(props: { readonly username: string }): JSX.Element {
  const relation = (): StoryRelation =>
    STORY_RELATIONS[props.username] ?? 'add';
  return (
    <Switch>
      <Match when={relation() === 'incoming'}>
        <StackHorizontal gap="sm">
          <Button
            title="Accept"
            variant="solid"
            size="sm"
            onClick={() => undefined}
          />
          <Button
            title="Decline"
            intent="neutral"
            variant="outline"
            size="sm"
            onClick={() => undefined}
          />
        </StackHorizontal>
      </Match>
      <Match when={relation() === 'friends'}>
        <StackHorizontal align="center" gap="xs">
          <CheckIcon size={16} color="success" />
          <Text variant="label" tone="success">
            Friends
          </Text>
        </StackHorizontal>
      </Match>
      <Match when={relation() === 'requested'}>
        <Button
          title="Cancel request"
          intent="neutral"
          variant="outline"
          size="sm"
          onClick={() => undefined}
        />
      </Match>
      <Match when={relation() === 'add'}>
        <Button
          title="Add friend"
          intent="neutral"
          variant="outline"
          size="sm"
          icon={UserPlusIcon}
          onClick={() => undefined}
        />
      </Match>
    </Switch>
  );
}

/**
 * Stand-in for the result row the app composes (the friends sub fills it
 * with the person and their status pill; otherwise avatar + username from
 * the device's data): the same shape, drawn from the result itself — the
 * person's face (their initials when their profile has not synced), the part
 * of the name the typed query matched emphasised,
 * a request that is out or one they sent as a tag under the name, and the
 * pill.
 */
export function StoryUserRow(props: {
  readonly user: UserSearchResult;
  readonly query: string;
}): JSX.Element {
  const name = (): string => `@${props.user.username}`;
  const ranges = () => rangesOfMatch(name(), props.query);
  return (
    <StackHorizontal align="center" gap="sm" paddingY="sm">
      <DeviceAvatar
        avatarConfig={parseAvatarConfig(props.user.avatarConfig)}
        seedFallback={props.user.userId}
        name={props.user.username}
        size={44}
      />
      <StackVertical grow shrink gap="xs">
        <Show
          when={ranges().length > 0}
          fallback={
            <P variant="body" lines={1}>
              {name()}
            </P>
          }
        >
          <HighlightedText
            text={name()}
            ranges={ranges()}
            variant="body"
            boldVariant="bodyBold"
            numberOfLines={1}
          />
        </Show>
        <Show when={STORY_RELATIONS[props.user.username] === 'requested'}>
          <Badge label="Request sent" intent="info" />
        </Show>
        <Show when={STORY_RELATIONS[props.user.username] === 'incoming'}>
          <Badge label="Asked you" intent="info" />
        </Show>
      </StackVertical>
      <StoryRelationPill username={props.user.username} />
    </StackHorizontal>
  );
}

/** The people who asked avery to be friends, newest first. */
const STORY_REQUESTERS = [
  storyResult('10', 'jordan'),
  storyResult('12', 'riley_k'),
];

function StoryRequesterRow(props: {
  readonly person: UserSearchResult;
}): JSX.Element {
  return (
    <MenuRow
      leading={
        <DeviceAvatar
          avatarConfig={parseAvatarConfig(props.person.avatarConfig)}
          seedFallback={props.person.userId}
          name={props.person.username}
          size={32}
        />
      }
      title={`@${props.person.username}`}
      caption="Wants to be friends"
      onClick={() => undefined}
    />
  );
}

/**
 * Stand-in for the friends sub's desktop column: jordan and riley_k asked
 * to be friends (each row opens their profile, where it is answered), and
 * the request to jordy is still waiting.
 */
export function StoryRequestsAside(): JSX.Element {
  return (
    <MenuSection
      title="Friend requests"
      footer="You sent 1 request that is still waiting."
    >
      <For each={STORY_REQUESTERS}>
        {(person) => <StoryRequesterRow person={person} />}
      </For>
    </MenuSection>
  );
}

/**
 * Stand-in for the friends sub's phone entry under the search field: one
 * "Friend requests" row with how many are waiting, which opens to the same
 * requesters the desktop column lists.
 */
export function StoryRequestsEntry(): JSX.Element {
  const [expanded, setExpanded] = createSignal(false);
  return (
    <MenuList>
      <MenuRow
        title="Friend requests"
        value={
          <Badge
            label={String(STORY_REQUESTERS.length)}
            intent="brand"
            tone="solid"
            size="sm"
          />
        }
        expanded={expanded()}
        onClick={() => setExpanded((now) => !now)}
      />
      <Show when={expanded()}>
        <For each={STORY_REQUESTERS}>
          {(person) => <StoryRequesterRow person={person} />}
        </For>
      </Show>
    </MenuList>
  );
}

import { DeviceAvatar } from '@libs/profile-client-ts/device-avatar';
import {
  parseAvatarConfig,
  serializeDefaultAvatarConfig,
} from '@libs/profile-shared-ts/avatar-config';
import type { UserSearchResult } from '@libs/user-search-shared-ts/user-search-types';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  HighlightedText,
  rangesAfterMatch,
} from '@pkgs/ui-root-client-ts/highlighted-text';
import {
  CheckIcon,
  ClockIcon,
  UserPlusIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Show, Switch } from 'solid-js';

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

/** How a stand-in row relates the viewer to a person, by username. */
const STORY_RELATIONS: Readonly<
  Record<string, 'add' | 'friends' | 'requested'>
> = { jordan: 'add', jordan_plays: 'friends', jordy: 'requested' };

/**
 * Stand-in for the friends sub's relationship: one trailing control per row,
 * "Friends" as words with a check in the success ink (a status, not a
 * control), "Request sent" as words with a clock beside a quiet ghost
 * "Cancel", or one small secondary pill ("Add friend").
 */
function StoryRelationPill(props: { readonly username: string }): JSX.Element {
  const relation = (): 'add' | 'friends' | 'requested' =>
    STORY_RELATIONS[props.username] ?? 'add';
  return (
    <Switch>
      <Match when={relation() === 'friends'}>
        <StackHorizontal align="center" gap="xs">
          <CheckIcon size={16} color="success" />
          <Text variant="label" tone="success">
            Friends
          </Text>
        </StackHorizontal>
      </Match>
      <Match when={relation() === 'requested'}>
        <StackHorizontal align="center" gap="xs">
          <StackHorizontal align="center" gap="xs">
            <ClockIcon size={16} color="textSecondary" />
            <Text variant="label" tone="secondary" lines={1}>
              Request sent
            </Text>
          </StackHorizontal>
          <Button
            title="Cancel"
            intent="neutral"
            variant="ghost"
            size="sm"
            onClick={() => undefined}
          />
        </StackHorizontal>
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
 * of the name after the typed query emphasised so similar names read apart,
 * and the pill.
 */
export function StoryUserRow(props: {
  readonly user: UserSearchResult;
  readonly query: string;
}): JSX.Element {
  const name = (): string => `@${props.user.username}`;
  const ranges = () => rangesAfterMatch(name(), props.query);
  return (
    <StackHorizontal align="center" gap="sm" paddingY="sm">
      <DeviceAvatar
        avatarConfig={parseAvatarConfig(props.user.avatarConfig)}
        seedFallback={props.user.userId}
        name={props.user.username}
        size={44}
      />
      <StackVertical grow>
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
      </StackVertical>
      <StoryRelationPill username={props.user.username} />
    </StackHorizontal>
  );
}

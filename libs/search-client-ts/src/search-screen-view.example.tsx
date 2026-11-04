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
import { CheckIcon, UserPlusIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Show, Switch } from 'solid-js';

/**
 * Story fixture: a person found by search, with a fixed id and the default
 * face every profile is seeded with (`synced: false` for one whose profile
 * has not reached this device, which shows their initials).
 */
export function storyResult(
  index: number,
  username: string,
  options: { readonly synced?: boolean } = {}
): UserSearchResult {
  const userId = `4a8d6b20-0000-4000-8000-00000000000${index}`;
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
 * control) or one small secondary pill ("Add friend", "Cancel request").
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
            <P variant="bodyBold" lines={1}>
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

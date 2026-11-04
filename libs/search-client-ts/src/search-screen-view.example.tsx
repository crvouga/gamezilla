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
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
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
 * every one ending on the same edge: "Friends" as words with a check in the
 * success ink (a status, not a control), a quiet ghost "Cancel request" for
 * one that is out (the row's "Request sent" status under the name reads
 * first), or "Add friend", a small outlined pill.
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
          variant="ghost"
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
 * a request that is out as a tag under the name, and the pill.
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
      </StackVertical>
      <StoryRelationPill username={props.user.username} />
    </StackHorizontal>
  );
}

/**
 * Stand-in for the friends sub's desktop column: morgan asked to be
 * friends (the row opens their profile, where it is answered), and the
 * request to jordy is still waiting.
 */
export function StoryRequestsAside(): JSX.Element {
  const morgan = storyResult('03', 'morgan');
  return (
    <MenuSection
      title="Friend requests"
      footer="You sent 1 request that is still waiting."
    >
      <MenuRow
        leading={
          <DeviceAvatar
            avatarConfig={parseAvatarConfig(morgan.avatarConfig)}
            seedFallback={morgan.userId}
            name={morgan.username}
            size={32}
          />
        }
        title="@morgan"
        caption="Wants to be friends"
        onClick={() => undefined}
      />
    </MenuSection>
  );
}

import type { UserSearchResult } from '@libs/user-search-shared-ts/user-search-types';
import { Avatar, avatarInitials } from '@pkgs/ui-root-client-ts/avatar';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  HighlightedText,
  rangesAfterMatch,
} from '@pkgs/ui-root-client-ts/highlighted-text';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Show, Switch } from 'solid-js';

/** Story fixture: a person found by search, with a fixed id. */
export function storyResult(index: number, username: string): UserSearchResult {
  return {
    userId: `4a8d6b20-0000-4000-8000-00000000000${index}`,
    username,
    avatarConfig: null,
  };
}

/** How a stand-in row relates the viewer to a person, by username. */
const STORY_RELATIONS: Readonly<
  Record<string, 'add' | 'friends' | 'requested'>
> = { jordan: 'add', jordan_plays: 'friends', jordy: 'requested' };

/**
 * Stand-in for the friends sub's relationship: "Add Friend" is the one
 * button; "Friends" and "Requested" are tags, with Cancel beside a request.
 */
function StoryRelationPill(props: { readonly username: string }): JSX.Element {
  const relation = (): 'add' | 'friends' | 'requested' =>
    STORY_RELATIONS[props.username] ?? 'add';
  return (
    <Switch>
      <Match when={relation() === 'friends'}>
        <Badge label="Friends" intent="success" />
      </Match>
      <Match when={relation() === 'requested'}>
        <StackHorizontal align="center" gap="sm">
          <Badge label="Requested" intent="neutral" />
          <Button title="Cancel" variant="ghost" onClick={() => undefined} />
        </StackHorizontal>
      </Match>
      <Match when={relation() === 'add'}>
        <Button title="Add Friend" onClick={() => undefined} />
      </Match>
    </Switch>
  );
}

/**
 * Stand-in for the result row the app composes (the friends sub fills it
 * with the person and their status pill; otherwise avatar + username from
 * the device's data): the same shape, drawn from the result itself —
 * tinted initials for a person without a picture, the part of the name after
 * the typed query emphasised so similar names read apart, and the pill.
 */
export function StoryUserRow(props: {
  readonly user: UserSearchResult;
  readonly query: string;
}): JSX.Element {
  const name = (): string => `@${props.user.username}`;
  const ranges = () => rangesAfterMatch(name(), props.query);
  return (
    <StackHorizontal align="center" gap="sm" paddingY="sm">
      <Avatar
        size={44}
        initials={avatarInitials(props.user.username)}
        tintKey={props.user.userId}
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

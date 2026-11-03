import type { UserSearchResult } from '@libs/user-search-shared-ts/user-search-types';
import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';

/** Story fixture: a person found by search, with a fixed id. */
export function storyResult(index: number, username: string): UserSearchResult {
  return {
    userId: `4a8d6b20-0000-4000-8000-00000000000${index}`,
    username,
    avatarConfig: null,
  };
}

/**
 * Stand-in for the result row the app composes (the friends sub fills it
 * with status pills; otherwise avatar + username from the device's data):
 * the same shape, drawn from the result itself.
 */
export function StoryUserRow(props: {
  readonly user: UserSearchResult;
}): JSX.Element {
  return (
    <StackHorizontal align="center" gap="sm" paddingY="sm">
      <Avatar
        size={44}
        initials={props.user.username.slice(0, 2).toUpperCase()}
      />
      <StackVertical grow>
        <P variant="bodyBold" lines={1}>
          {`@${props.user.username}`}
        </P>
      </StackVertical>
    </StackHorizontal>
  );
}

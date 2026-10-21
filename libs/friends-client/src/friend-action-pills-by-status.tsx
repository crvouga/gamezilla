import type { FriendActionMutations } from '@libs/friends-shared/friend-action-types';
import type { FriendshipStatus } from '@libs/friends-shared/friends-types';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import type { Accessor, JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { renderFriendActionPillsForStatus } from './friend-action-status-renderers';

export function FriendActionPillsForStatus(props: {
  status: FriendshipStatus;
  mutations: FriendActionMutations;
  addFailureCode: Accessor<string | null>;
  onChanged?: (() => void) | undefined;
  username?: string | undefined;
}): JSX.Element {
  const wrap = (fn: () => Promise<void>) => async () => {
    await fn();
    props.onChanged?.();
  };

  // Re-render pills whenever status (or username) changes. A one-shot
  // Show fallback stayed on "Add Friend" after send succeeded because
  // none → pending_outgoing keeps `when={blocked_by_them}` false.
  const view = createMemo(() => {
    const status = props.status;
    const pills = renderFriendActionPillsForStatus({
      status,
      mutations: props.mutations,
      addFailureCode: props.addFailureCode,
      wrap,
      username: props.username,
    });
    if (status === 'blocked_by_them') {
      return <StackVertical self="stretch">{pills}</StackVertical>;
    }
    return pills;
  });

  return <>{view()}</>;
}

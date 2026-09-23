import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';

import type { FriendshipStatus } from '../../shared/friendship/friends-types';
import {
  renderFriendActionPillsForStatus,
  useFriendActionLabels,
} from './friend-action-status-renderers';
import type { FriendActionMutations } from './friend-action-types';

export function FriendActionPillsForStatus(props: {
  status: FriendshipStatus;
  mutations: FriendActionMutations;
  onChanged?: (() => void) | undefined;
  username?: string | undefined;
}): JSX.Element {
  const labels = useFriendActionLabels();
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
      wrap,
      labels,
      username: props.username,
    });
    if (status === 'blocked_by_them') {
      return <div class="box self-stretch">{pills}</div>;
    }
    return pills;
  });

  return <>{view()}</>;
}

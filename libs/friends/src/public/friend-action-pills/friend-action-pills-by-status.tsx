import { useLingui } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import type { FriendshipStatus } from '../../shared/friendship/friends-types';
import { renderFriendActionPillsForStatus } from './friend-action-status-renderers';
import type { FriendActionMutations } from './friend-action-types';

export function FriendActionPillsForStatus(props: {
  status: FriendshipStatus;
  mutations: FriendActionMutations;
  onChanged?: (() => void) | undefined;
  username?: string | undefined;
}): JSX.Element {
  const { t } = useLingui();
  const wrap = (fn: () => Promise<void>) => async () => {
    await fn();
    props.onChanged?.();
  };
  const pills = renderFriendActionPillsForStatus({
    status: props.status,
    mutations: props.mutations,
    wrap,
    t,
    username: props.username,
  });

  return (
    <Show when={props.status === 'blocked_by_them'} fallback={pills}>
      <div class="box self-stretch">{pills}</div>
    </Show>
  );
}

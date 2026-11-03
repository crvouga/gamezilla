import type { FriendActionPillsProps } from '@libs/friends-shared-ts/friend-action-types';
import type { JSX } from 'solid-js';
import { FriendActionPillsForStatus } from './friend-action-pills-by-status';
import { useFriendActionMutations } from './use-friend-action-mutations';

/** The friend action pills for one person, wired to the friend mutations. */
export function FriendActionPills(props: FriendActionPillsProps): JSX.Element {
  const actions = useFriendActionMutations({
    userId: () => props.userId,
    incomingRequestId: () => props.incomingRequestId,
    outgoingRequestId: () => props.outgoingRequestId,
  });
  return (
    <FriendActionPillsForStatus
      status={props.status}
      mutations={actions.mutations}
      addFailureCode={actions.addFailureCode}
      onChanged={props.onChanged}
      {...(props.username !== undefined ? { username: props.username } : {})}
    />
  );
}

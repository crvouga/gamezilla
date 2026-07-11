import { useFriendMutations } from './friend-action-context';
import type { FriendActionPillsProps } from './friend-action-context';
import { FriendActionPillsForStatus } from './friend-action-pills-by-status';
import type { ReactNode } from 'react';

export function FriendActionPills({
  onChanged,
  ...ctx
}: FriendActionPillsProps): ReactNode {
  const mutations = useFriendMutations(ctx);
  return (
    <FriendActionPillsForStatus
      status={ctx.status}
      mutations={mutations}
      onChanged={onChanged}
    />
  );
}

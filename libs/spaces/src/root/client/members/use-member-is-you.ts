import { useMyId } from '@libs/auth/public/use-current-user';
import { type Accessor, createMemo } from 'solid-js';

/** Whether `memberId` is this user's member identity (`users.id`). */
export function useMemberIsYou(memberId: string): Accessor<boolean> {
  const myId = useMyId();
  return createMemo(() => myId() === memberId);
}

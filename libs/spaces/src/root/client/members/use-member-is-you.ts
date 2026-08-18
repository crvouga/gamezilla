import { useMyId } from '@libs/auth/public/use-current-user';

/** Whether `memberId` is this user's member identity (`users.id`). */
export function useMemberIsYou(memberId: string): boolean {
  return useMyId() === memberId;
}

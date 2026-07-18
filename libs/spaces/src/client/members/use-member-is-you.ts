import { useMyId } from '@libs/auth/client/use-current-user';

/** Whether `memberId` is this user's member identity (account or anon device). */
export function useMemberIsYou(memberId: string): boolean {
  return useMyId() === memberId;
}

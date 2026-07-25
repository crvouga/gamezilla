import { useMyAccountId } from '@libs/auth/client/use-current-user';
import { spaceMembershipEntityId } from '@libs/spaces/shared/membership-key';

/**
 * Membership id `${accountId}:${spaceId}` for this account in the given
 * space, or `null` when signed out.
 *
 * Derived id only — does not check whether the membership row exists.
 */
export function useMyMembershipId(spaceId: string): string | null {
  const accountId = useMyAccountId();
  if (accountId === null || accountId.length === 0 || spaceId.length === 0) {
    return null;
  }
  return spaceMembershipEntityId(accountId, spaceId);
}

/** @deprecated Alias of {@link useMyMembershipId}. */
export const useMyGuestMembershipId = useMyMembershipId;

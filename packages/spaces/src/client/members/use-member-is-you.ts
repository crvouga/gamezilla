import { useMyProfileId } from '@gamezilla/profile/client/use-my-profile-id';

/** Whether `profileId` is the current user's profile id. */
export function useMemberIsYou(profileId: string): boolean {
  return useMyProfileId() === profileId;
}

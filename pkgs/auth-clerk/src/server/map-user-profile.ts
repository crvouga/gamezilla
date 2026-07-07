import type { User } from '@clerk/backend';
import type { AuthUserProfile } from '@pkgs/auth/shared/user-profile';

export function mapClerkUserToProfile(user: User): AuthUserProfile {
  const email = user.primaryEmailAddress?.emailAddress ?? null;
  const displayName = user.fullName ?? user.username ?? null;

  return {
    externalUserId: user.id,
    email,
    displayName,
    avatarUrl: user.imageUrl,
  };
}

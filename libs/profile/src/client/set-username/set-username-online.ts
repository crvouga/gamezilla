import type { ProfileCard } from '../../shared/profile-card';
import {
  profileApiJson,
  type ProfileClientDeps,
} from '../profile-api';

export async function setUsernameOnline(
  deps: ProfileClientDeps,
  username: string
): Promise<ProfileCard> {
  const body = await profileApiJson<{ profile: ProfileCard }>({
    ...deps,
    path: '/profile/username',
    init: {
      method: 'PUT',
      body: JSON.stringify({ username }),
    },
  });
  return body.profile;
}

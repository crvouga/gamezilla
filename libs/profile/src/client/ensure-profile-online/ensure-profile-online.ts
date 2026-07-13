import type { ProfileCard } from '../../shared/profile-card';
import {
  profileApiJson,
  type ProfileClientDeps,
} from '../profile-api';

export async function ensureProfileOnline(
  deps: ProfileClientDeps
): Promise<ProfileCard> {
  const body = await profileApiJson<{ profile: ProfileCard }>({
    ...deps,
    path: '/profile/ensure',
    init: { method: 'POST', body: '{}' },
  });
  return body.profile;
}

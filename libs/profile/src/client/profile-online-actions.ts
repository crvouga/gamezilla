import type { ConfigService } from '@libs/auth/client/config-service-types';

import type { ProfileCard } from '../shared/profile-card';
import { profileApiJson, type ProfileApiFetch } from './profile-api';

export type ProfileClientDeps = {
  readonly config: ConfigService;
  readonly fetchFn: ProfileApiFetch;
};

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

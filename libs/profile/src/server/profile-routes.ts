import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import { Hono } from 'hono';

import { handleEnsureProfile } from './ensure-profile-online/handle-ensure-profile';
import { handleSetUsername } from './set-username/handle-set-username';

export function createProfileApp(): Hono<ApiHonoEnv> {
  return new Hono<ApiHonoEnv>()
    .post('/profile/ensure', handleEnsureProfile)
    .put('/profile/username', handleSetUsername);
}

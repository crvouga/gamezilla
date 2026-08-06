import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import { Hono } from 'hono';

import { handleEnsureProfile } from './ensure-profile-online/handle-ensure-profile';

export function createProfileApp(): Hono<ApiHonoEnv> {
  return new Hono<ApiHonoEnv>().post('/profile/ensure', handleEnsureProfile);
}

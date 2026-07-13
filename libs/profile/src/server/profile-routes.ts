import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import { Hono } from 'hono';

import {
  handleEnsureProfile,
  handleSetUsername,
} from './profile-route-handlers';

export function createProfileApp(): Hono<ApiHonoEnv> {
  return new Hono<ApiHonoEnv>()
    .post('/profile/ensure', handleEnsureProfile)
    .put('/profile/username', handleSetUsername);
}

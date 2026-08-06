import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import type { Context } from 'hono';

import type { ProfileCard } from '../../shared/profile-card';
import { withProfileAuth } from '../profile-route-auth';
import { ensureProfileWithUsername } from './ensure-profile-service';

export function handleEnsureProfile(c: Context<ApiHonoEnv>): Promise<Response> {
  return withProfileAuth(c, async (auth) => {
    const sql = c.get('sqlClient');
    const profile: ProfileCard = await ensureProfileWithUsername(
      sql,
      auth.myId,
      {
        // Anon and signed-in users both have a real `users` row.
        requireUserRow: true,
      }
    );
    return c.json({ profile });
  });
}

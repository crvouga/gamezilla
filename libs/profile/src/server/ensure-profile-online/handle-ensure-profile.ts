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
        // Signed-in: profile id is users.id — refuse minting without that row.
        requireUserRow: auth.accountId !== null,
      }
    );
    return c.json({ profile });
  });
}

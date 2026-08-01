import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import type { Context } from 'hono';

import type { ProfileCard } from '../../shared/profile-card';
import { profileErrorFromValidation } from '../../shared/profile-errors';
import { normalizeUsername, validateUsername } from '../../shared/username';
import { withProfileAuth, writeFailureStatus } from '../profile-route-auth';
import { setProfileUsername } from './set-username-service';

export function handleSetUsername(c: Context<ApiHonoEnv>): Promise<Response> {
  return withProfileAuth(c, async (auth) => {
    const body = (await c.req.json()) as { readonly username?: string };
    const sql = c.get('sqlClient');
    const username = normalizeUsername(body.username ?? '');
    const validationError = validateUsername(username);
    if (validationError !== null) {
      const err = profileErrorFromValidation(validationError);
      return c.json(
        { error: err.message, code: err.code },
        writeFailureStatus(err.code)
      );
    }
    const profile: ProfileCard = await setProfileUsername(
      sql,
      auth.myId,
      body.username ?? ''
    );
    return c.json({ profile });
  });
}

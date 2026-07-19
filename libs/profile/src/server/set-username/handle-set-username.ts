import { mapAppAuthToWriteContext } from '@libs/auth/shared/map-app-auth-to-write-context';
import { runWrite } from '@pkgs/write/shared/run-write';
import { isWriteFailure, unwrap } from '@pkgs/write/shared/write-result';
import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import type { Context } from 'hono';

import type { ProfileCard } from '../../shared/profile-card';
import { withProfileAuth, writeFailureStatus } from '../profile-route-auth';
import { profileSetUsernameWrite } from './profile-set-username-write';

export function handleSetUsername(c: Context<ApiHonoEnv>): Promise<Response> {
  return withProfileAuth(c, async (auth) => {
    const body = (await c.req.json()) as { readonly username?: string };
    const sql = c.get('sqlClient');
    const writeContext = mapAppAuthToWriteContext(auth);
    const result = await runWrite({
      write: profileSetUsernameWrite,
      ctx: writeContext,
      rawInput: { username: body.username ?? '' },
      sql,
      mode: 'full',
    });
    if (isWriteFailure(result)) {
      return c.json(
        { error: result.message, code: result.code },
        writeFailureStatus(result.code)
      );
    }
    const profile: ProfileCard = unwrap(result);
    return c.json({ profile });
  });
}

import { mapAppAuthToWriteContext } from '@libs/auth/shared/map-app-auth-to-write-context';
import { createSqlWriteStore } from '@pkgs/write/server/create-sql-write-store';
import { runWrite } from '@pkgs/write/shared/run-write';
import { isWriteFailure, unwrap } from '@pkgs/write/shared/write-result';
import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import type { Context } from 'hono';

import { profileEnsureWrite } from './writes/profile-ensure-write';
import { profileSetUsernameWrite } from './writes/profile-set-username-write';
import type { ProfileCard } from '../shared/profile-card';
import { withProfileAuth } from './profile-route-auth';
import type { ProfileErrorCode } from '../shared/profile-errors';

function writeFailureStatus(
  code: string
): 400 | 401 | 404 | 409 | 429 {
  switch (code as ProfileErrorCode) {
    case 'PROFILE_NOT_AUTHENTICATED':
      return 401;
    case 'PROFILE_NOT_FOUND':
      return 404;
    case 'PROFILE_USERNAME_TAKEN':
      return 409;
    case 'PROFILE_USERNAME_COOLDOWN':
      return 429;
    default:
      return 400;
  }
}

export function handleEnsureProfile(
  c: Context<ApiHonoEnv>
): Promise<Response> {
  return withProfileAuth(c, async (auth) => {
    const sql = c.get('sqlClient');
    const store = createSqlWriteStore(sql);
    const writeContext = mapAppAuthToWriteContext(auth);
    const result = await runWrite({
      write: profileEnsureWrite,
      ctx: writeContext,
      rawInput: {},
      store,
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

export function handleSetUsername(c: Context<ApiHonoEnv>): Promise<Response> {
  return withProfileAuth(c, async (auth) => {
    const body = (await c.req.json()) as { readonly username?: string };
    const sql = c.get('sqlClient');
    const store = createSqlWriteStore(sql);
    const writeContext = mapAppAuthToWriteContext(auth);
    const result = await runWrite({
      write: profileSetUsernameWrite,
      ctx: writeContext,
      rawInput: { username: body.username ?? '' },
      store,
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

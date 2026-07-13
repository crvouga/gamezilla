import { mapAppAuthToWriteContext } from '@libs/auth/shared/map-app-auth-to-write-context';
import { runWrite } from '@pkgs/write/shared/run-write';
import { isWriteFailure, unwrap } from '@pkgs/write/shared/write-result';
import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import type { Context } from 'hono';

import type { ProfileCard } from '../../shared/profile-card';
import {
  withProfileAuth,
  writeFailureStatus,
} from '../profile-route-auth';
import { profileEnsureWrite } from './profile-ensure-write';

export function handleEnsureProfile(c: Context<ApiHonoEnv>): Promise<Response> {
  return withProfileAuth(c, async (auth) => {
    const sql = c.get('sqlClient');
    const writeContext = mapAppAuthToWriteContext(auth);
    const result = await runWrite({
      write: profileEnsureWrite,
      ctx: writeContext,
      rawInput: {},
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

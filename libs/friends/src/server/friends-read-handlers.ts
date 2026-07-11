import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import type { Context } from 'hono';

import { FriendService } from './friend-service';
import { readRequiredString } from './friends-route-utils';
import { withFriendsAuth } from './friends-route-auth';

export function handleListFriendRequests(
  c: Context<ApiHonoEnv>
): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const sql = c.get('sqlClient');
    const summary = await FriendService.listFriendRequestsSummary(
      sql,
      auth.myId
    );
    return c.json(summary);
  });
}

export function handleReadFriendUser(
  c: Context<ApiHonoEnv>
): Promise<Response> {
  return withFriendsAuth(c, async (auth) => {
    const userId = readRequiredString(c.req.param('userId'), 'userId');
    const sql = c.get('sqlClient');
    const user = await FriendService.readFriendUserProfile(
      sql,
      auth.myId,
      userId
    );
    return c.json({ user });
  });
}

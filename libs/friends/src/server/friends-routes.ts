import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import { FriendService } from '@libs/friends/server/friend-service';
import { getIo } from '@pkgs/io';
import { Hono } from 'hono';

import { withFriendsAuth } from './friends-route-auth';
import { readRequiredString } from './friends-route-utils';

type SearchBody = { readonly query?: string; readonly limit?: number };

async function handleSearchUsers(c: Parameters<typeof withFriendsAuth>[0]) {
  return withFriendsAuth(c, async (auth) => {
    const body = (await c.req.json()) as SearchBody;
    const query = readRequiredString(body.query, 'query');
    const results = await FriendService.searchUsers({
      db: c.get('sqlClient'),
      viewerId: auth.myId,
      rawQuery: query,
      now: getIo().clock.now,
      ...(typeof body.limit === 'number' ? { limit: body.limit } : {}),
    });
    return c.json({ results });
  });
}

export function createFriendsApp(): Hono<ApiHonoEnv> {
  return new Hono<ApiHonoEnv>().post('/friends/search', handleSearchUsers);
}

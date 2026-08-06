import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import { FriendService } from '@libs/friends/server/friend-service';
import { Hono } from 'hono';

import { withFriendsAuth } from './friends-route-auth';
import { readRequiredString } from './friends-route-utils';

type SearchBody = { readonly query?: string; readonly limit?: number };

async function handleSearchUsers(c: Parameters<typeof withFriendsAuth>[0]) {
  return withFriendsAuth(c, async (auth) => {
    const body = (await c.req.json()) as SearchBody;
    const query = readRequiredString(body.query, 'query');
    const results = await FriendService.searchUsers(
      c.get('sqlClient'),
      auth.myId,
      query,
      typeof body.limit === 'number' ? body.limit : undefined
    );
    return c.json({ results });
  });
}

export function createFriendsApp(): Hono<ApiHonoEnv> {
  return new Hono<ApiHonoEnv>().post('/friends/search', handleSearchUsers);
}

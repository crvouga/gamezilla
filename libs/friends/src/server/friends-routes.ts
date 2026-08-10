import type { ApiHonoEnv } from '@libs/auth/server/api-hono-env';
import { getIo } from '@pkgs/io/als';
import { Hono } from 'hono';
import { FriendSearchService } from './friend-search-service';
import { withFriendsAuth } from './friends-route-auth';
import { readRequiredString } from './friends-route-utils';

type SearchBody = { readonly query?: string; readonly limit?: number };

async function handleSearchUsers(c: Parameters<typeof withFriendsAuth>[0]) {
  return withFriendsAuth(c, async (auth) => {
    const body = (await c.req.json()) as SearchBody;
    const query = readRequiredString(body.query, 'query');
    const searchService = new FriendSearchService(c.get('sqlClient'));
    const results = await searchService.searchUsers({
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

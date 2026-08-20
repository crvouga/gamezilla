import type { ApiHonoEnv } from '@libs/auth/public/api-hono-env';
import type { Clock } from '@pkgs/clock';
import { Hono } from 'hono';
import { withFriendsAuth } from '../../use-cases/search-friends/server/friends-route-auth';
import { readRequiredString } from '../../use-cases/search-friends/server/friends-route-utils';
import { SearchFriendsUseCase } from '../../use-cases/search-friends/server/search-friends-use-case';

type SearchBody = { readonly query?: string; readonly limit?: number };

export class FriendsApp {
  constructor(private readonly clock: Clock) {}

  build(): Hono<ApiHonoEnv> {
    return new Hono<ApiHonoEnv>().post('/friends/search', async (c) => {
      return withFriendsAuth(c, async (auth) => {
        const body = (await c.req.json()) as SearchBody;
        const query = readRequiredString(body.query, 'query');
        const results = await new SearchFriendsUseCase(
          c.get('sqlClient'),
          this.clock
        ).execute({
          viewerId: auth.myId,
          rawQuery: query,
          ...(typeof body.limit === 'number' ? { limit: body.limit } : {}),
        });
        return c.json({ results });
      });
    });
  }
}

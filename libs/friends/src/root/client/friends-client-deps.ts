import type { ClientRequestAuth } from '@libs/auth/public/client-request-auth';
import type { ConfigService } from '@libs/auth/public/config-service-types';

import type { FriendsApiFetch } from '../../use-cases/search-friends/client/friends-api-client';

export type FriendsClientDeps = {
  readonly config: ConfigService;
  readonly fetchFn: FriendsApiFetch;
  readonly auth: ClientRequestAuth;
};

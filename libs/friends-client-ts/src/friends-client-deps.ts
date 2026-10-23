import type { ClientRequestAuth } from '@libs/auth-shared-ts/client-request-auth';
import type { ConfigService } from '@libs/auth-shared-ts/config-service-types';

import type { FriendsApiFetch } from './friends-api-client';

export type FriendsClientDeps = {
  readonly config: ConfigService;
  readonly fetchFn: FriendsApiFetch;
  readonly auth: ClientRequestAuth;
};

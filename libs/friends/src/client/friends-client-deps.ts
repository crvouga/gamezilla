import type { ConfigService } from '@libs/auth/client/config-service-types';

import type { FriendsApiFetch } from './friends-api';

export type FriendsClientDeps = {
  readonly config: ConfigService;
  readonly fetchFn: FriendsApiFetch;
};

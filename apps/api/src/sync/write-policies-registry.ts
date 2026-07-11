import { AUTH_WRITE_POLICIES } from '@libs/auth/server/write-policies';
import { CHESS_WRITE_POLICIES } from '@libs/chess/server/write-policies';
import { CLIENT_CONFIG_WRITE_POLICIES } from '@libs/client-config/server/write-policies';
import { FRIENDS_WRITE_POLICIES } from '@libs/friends/server/write-policies';
import { PROFILE_WRITE_POLICIES } from '@libs/profile/server/write-policies';
import { SPACE_WRITE_POLICIES } from '@libs/spaces/server/write-policies';
import { createWritePolicyRegistry } from '@pkgs/sync-engine/server/upload-handler';
import { ENTITY_STORE_TABLE } from '@libs/db/shared/entity-store-table';

import { entityStoreWritePolicy } from './write-policies-entity-store';

/** Postgres table-name keyed write policies (PowerSync upload ABAC). */
export const SYNC_WRITE_POLICY_REGISTRY = createWritePolicyRegistry({
  ...AUTH_WRITE_POLICIES,
  ...PROFILE_WRITE_POLICIES,
  ...SPACE_WRITE_POLICIES,
  ...CHESS_WRITE_POLICIES,
  ...CLIENT_CONFIG_WRITE_POLICIES,
  ...FRIENDS_WRITE_POLICIES,
  [ENTITY_STORE_TABLE]: entityStoreWritePolicy,
});

import { CLIENT_CONFIG_SYSTEM_ONLY } from '@libs/client-config/shared/writes/row-bindings';
import { CLIENT_CONFIG_TABLE } from '@libs/db/shared/client-config-tables';
import { INBOX_SERVER_MANAGED } from '@pkgs/inbox/shared/writes/row-bindings';
import {
  createTablePolicyRegistry,
  denyTablePolicy,
} from '@pkgs/sync-engine/server/apply-batch';

import { authProfileChessTablePolicies } from './table-policies-auth-profile-chess';
import { entityStoreTablePolicies } from './table-policies-entity-store';
import { friendsTablePolicies } from './table-policies-friends';
import { spacesTablePolicies } from './table-policies-spaces';

export const APP_TABLE_POLICIES = createTablePolicyRegistry([
  ...authProfileChessTablePolicies(),
  ...spacesTablePolicies(),
  ...friendsTablePolicies(),
  ...entityStoreTablePolicies(),
  denyTablePolicy(CLIENT_CONFIG_TABLE.tableName, CLIENT_CONFIG_SYSTEM_ONLY),
  denyTablePolicy('inbox_interactions', INBOX_SERVER_MANAGED),
  denyTablePolicy('inbox_preferences', INBOX_SERVER_MANAGED),
]);

import { createTableRegistry } from '@pkgs/sync-engine/shared/table-registry';

import { AUTH_TABLE_DEFINITIONS } from './auth-tables';
import { ALL_CHESS_SYNC_TABLES } from './chess-tables';
import { ALL_CLIENT_CONFIG_SYNC_TABLES } from './client-config-tables';
import { ENTITY_STORE_TABLE_DEF } from './entity-store-table';
import { ALL_PROFILE_SYNC_TABLES } from './profile-tables';
import { ALL_SPACE_SYNC_TABLES } from './space-tables';

/** Composed PowerSync / local SQLite table registry for the source DB. */
export const SYNC_TABLE_REGISTRY = createTableRegistry([
  ...AUTH_TABLE_DEFINITIONS,
  ...ALL_PROFILE_SYNC_TABLES,
  ...ALL_SPACE_SYNC_TABLES,
  ...ALL_CHESS_SYNC_TABLES,
  ...ALL_CLIENT_CONFIG_SYNC_TABLES,
  ENTITY_STORE_TABLE_DEF,
]);

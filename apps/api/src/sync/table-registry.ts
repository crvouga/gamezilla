import { AUTH_TABLE_DEFINITIONS } from '@libs/auth/shared/auth-tables';
import { ALL_CHESS_SYNC_TABLES } from '@libs/chess/shared/sync-tables';
import { ALL_CLIENT_CONFIG_SYNC_TABLES } from '@libs/client-config/shared/sync-tables';
import { ALL_PROFILE_SYNC_TABLES } from '@libs/profile/shared/sync-tables';
import { ALL_SPACE_SYNC_TABLES } from '@libs/spaces/shared/sync-tables';
import { ENTITY_STORE_TABLE_DEF } from '@pkgs/sync-engine/shared/entity-store';
import { createTableRegistry } from '@pkgs/sync-engine/shared/table-registry';

/** Composed PowerSync / local SQLite table registry for the API source DB. */
export const API_SYNC_TABLE_REGISTRY = createTableRegistry([
  ...AUTH_TABLE_DEFINITIONS,
  ...ALL_PROFILE_SYNC_TABLES,
  ...ALL_SPACE_SYNC_TABLES,
  ...ALL_CHESS_SYNC_TABLES,
  ...ALL_CLIENT_CONFIG_SYNC_TABLES,
  ENTITY_STORE_TABLE_DEF,
]);

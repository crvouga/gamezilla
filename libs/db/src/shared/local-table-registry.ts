import { createTableRegistry } from '@pkgs/sync-engine/shared/table-registry';

import { ALL_LOCAL_SPACE_TABLES } from './local-space-open-sessions-table';

/**
 * Client-only PowerSync tables (`local_*` / `localOnly: true`).
 * Never composed into {@link SYNC_TABLE_REGISTRY} / Postgres / upload.
 */
export const LOCAL_CLIENT_TABLE_REGISTRY = createTableRegistry([
  ...ALL_LOCAL_SPACE_TABLES,
]);

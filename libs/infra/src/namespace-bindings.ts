import { createPostgresDbScope } from '@pkgs/sql-client/postgres-schema';

import { PROJECT_CONFIG } from './project-config';

/** Postgres schema scope for this product — minted from {@link PROJECT_CONFIG}. */
export function appPostgresDbScope() {
  return createPostgresDbScope(PROJECT_CONFIG.postgres.schema);
}

/** Root wire-key prefix for remote object storage (trailing slash). */
export function appObjectStoreRootPrefix(): `${string}/` {
  return `${PROJECT_CONFIG.objectStore.namespace}/`;
}

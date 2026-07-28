import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';

import { PROJECT_CONFIG } from './project-config';

/** Postgres `public` schema scope for this product. */
export function appPostgresDbScope() {
  return createPostgresDbScope(PROJECT_CONFIG.postgres.schema);
}

/** Root wire-key prefix for remote object storage (trailing slash). */
export function appObjectStoreRootPrefix(): `${string}/` {
  return `${PROJECT_CONFIG.objectStore.namespace}/`;
}

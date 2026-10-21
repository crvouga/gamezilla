import { createPostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';

import { PRODUCT_CONFIG } from './product-config';

/** Postgres `public` schema scope for this product. */
export function appPostgresDbScope() {
  return createPostgresDbScope(PRODUCT_CONFIG.postgres.schema);
}

/** Root wire-key prefix for remote object storage (trailing slash). */
export function appObjectStoreRootPrefix(): `${string}/` {
  return `${PRODUCT_CONFIG.objectStore.namespace}/`;
}

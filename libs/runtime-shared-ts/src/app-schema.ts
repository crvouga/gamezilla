import { assertProductSchema } from '@pkgs/db-schema-root-shared-ts/product-schema';

import { APP } from './app-subs';

/** Registered domain ids for composed app schema tables. */
export const APP_SCHEMA_DOMAINS = APP.domains;

/** Declarative domain schema for Postgres + local SQLite. */
export const appSchema = APP.schema;

assertProductSchema(appSchema);

/** Domain table names present on the local SQLite client (CACHE). */
export const LOCAL_DOMAIN_TABLE_NAMES = APP.tableNames;

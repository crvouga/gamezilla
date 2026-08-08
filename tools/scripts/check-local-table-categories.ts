#!/usr/bin/env bun
/**
 * Enforce CACHE vs DURABLE table categories for local.db.
 * Framework table names stay inside @pkgs/sync-engine; this script only
 * passes domain names into an opaque collision check.
 */
import { assertDomainTablesAvoidFrameworkNames } from '@pkgs/sync-engine/shared';
import { LOCAL_DOMAIN_TABLE_NAMES } from '../../libs/db/src/shared/app-schema';

try {
  assertDomainTablesAvoidFrameworkNames(LOCAL_DOMAIN_TABLE_NAMES);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('check:local-table-categories FAILED:');
  console.error(message);
  process.exit(1);
}

console.log(
  `ci:no-local-tables OK (${String(LOCAL_DOMAIN_TABLE_NAMES.length)} domain tables)`
);

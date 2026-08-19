#!/usr/bin/env bun
/**
 * Enforce domain table prefix policy on appSchema + reserved prefix exclusion,
 * sync-engine framework names, and Better Auth modelNames.
 */
import {
  APP_SCHEMA_DOMAINS,
  LOCAL_DOMAIN_TABLE_NAMES,
} from '@libs/runtime/root/app-schema';
import { FRAMEWORK_TABLE_NAMES } from '@pkgs/sync-engine/shared';
// Relative: keep `@pkgs/auth-better-auth` behind the adapter / composition-root allowlist.
import { BETTER_AUTH_TABLE_NAMES } from '../../pkgs/auth-better-auth/src/server/better-auth-table-names';

const RESERVED = ['sync_engine', 'better_auth'] as const;

function matchesDomain(name: string, domain: string): boolean {
  return name === domain || name.startsWith(`${domain}_`);
}

const failures: string[] = [];

for (const name of LOCAL_DOMAIN_TABLE_NAMES) {
  const ok = APP_SCHEMA_DOMAINS.some((d) => matchesDomain(name, d));
  if (!ok) {
    failures.push(
      `domain table '${name}' does not match APP_SCHEMA_DOMAINS=[${APP_SCHEMA_DOMAINS.join(', ')}]`
    );
  }
  for (const reserved of RESERVED) {
    if (matchesDomain(name, reserved)) {
      failures.push(
        `domain table '${name}' must not use reserved prefix '${reserved}_'`
      );
    }
  }
}

for (const name of FRAMEWORK_TABLE_NAMES) {
  if (!name.startsWith('sync_engine_')) {
    failures.push(`framework table '${name}' must start with sync_engine_`);
  }
}

for (const [model, table] of Object.entries(BETTER_AUTH_TABLE_NAMES)) {
  if (!table.startsWith('better_auth_')) {
    failures.push(
      `Better Auth ${model} modelName '${table}' must start with better_auth_`
    );
  }
}

if (failures.length > 0) {
  console.error('ci:domain-table-prefixes FAILED:');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(
  `ci:domain-table-prefixes OK (${String(LOCAL_DOMAIN_TABLE_NAMES.length)} domain, ${String(FRAMEWORK_TABLE_NAMES.length)} framework, ${String(Object.keys(BETTER_AUTH_TABLE_NAMES).length)} better-auth)`
);

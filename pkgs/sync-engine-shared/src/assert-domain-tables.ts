import {
  FRAMEWORK_CACHE_TABLE_NAMES,
  FRAMEWORK_DURABLE_TABLE_NAMES,
} from './framework-server-ddl';

/**
 * Opaque collision check: domain table names must not collide with framework
 * durable/cache tables. Framework table name lists stay Internal.
 */
export function assertDomainTablesAvoidFrameworkNames(
  domainTableNames: readonly string[]
): void {
  const durable = new Set<string>(FRAMEWORK_DURABLE_TABLE_NAMES);
  const cache = new Set<string>(FRAMEWORK_CACHE_TABLE_NAMES);
  const violations: string[] = [];

  for (const name of domainTableNames) {
    if (name.startsWith('local_')) {
      violations.push(
        `${name}: local_ prefix forbidden (use CACHE domain tables)`
      );
    }
    if (durable.has(name)) {
      violations.push(`${name}: durable framework table listed as domain`);
    }
  }

  for (const name of durable) {
    if (cache.has(name)) {
      violations.push(`${name}: cannot be both DURABLE and FRAMEWORK_CACHE`);
    }
  }

  if (violations.length > 0) {
    throw new Error(
      `Domain table category check failed:\n${violations.map((v) => `  - ${v}`).join('\n')}`
    );
  }
}

/**
 * Regression guard for the package's `exports` map. Only the documented
 * public subpaths may resolve; adapter internals stay unreachable.
 */

import { describe, expect, test } from 'bun:test';

const FORBIDDEN_SPECIFIERS = [
  '@pkgs/matchmaking',
  '@pkgs/matchmaking/storage',
  '@pkgs/matchmaking/matchmaker',
  '@pkgs/matchmaking/migrate',
  '@pkgs/matchmaking/migrate-sql',
  '@pkgs/matchmaking/app',
  '@pkgs/matchmaking/tick-sql',
  '@pkgs/matchmaking/formula-wire',
  '@pkgs/matchmaking/payload-limits',
  '@pkgs/matchmaking/join-helpers',
  '@pkgs/matchmaking/matchmaker-internals',
  '@pkgs/matchmaking/index',
  '@pkgs/matchmaking/impl-sql/migrate',
  '@pkgs/matchmaking/impl-sql/matchmaker',
  '@pkgs/matchmaking/impl-in-memory',
  '@pkgs/matchmaking/interface/app',
] as const;

const ALLOWED_SUBPATHS = [
  '@pkgs/matchmaking/interface',
  '@pkgs/matchmaking/impl-sql',
  '@pkgs/matchmaking/wire',
  '@pkgs/matchmaking/client',
  '@pkgs/matchmaking/testing',
] as const;

describe('package exports lockdown', () => {
  for (const specifier of FORBIDDEN_SPECIFIERS) {
    test(`forbids \`${specifier}\``, async () => {
      let resolved: string | undefined;
      try {
        resolved = await import.meta.resolve(specifier);
      } catch {
        return;
      }
      throw new Error(
        `lockdown breach: \`${specifier}\` resolved to \`${String(resolved)}\`. ` +
          `Only the documented public subpaths may be reachable.`
      );
    });
  }

  for (const specifier of ALLOWED_SUBPATHS) {
    test(`allows \`${specifier}\``, async () => {
      const resolved = await import.meta.resolve(specifier);
      expect(typeof resolved).toBe('string');
      expect(resolved.length).toBeGreaterThan(0);
    });
  }
});

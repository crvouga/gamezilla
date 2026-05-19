/**
 * Regression guard for the package's `exports` map. The whole
 * "air-tight" claim in the README rests on three subpaths
 * (`.`, `./storage`, `./wire`) being the ONLY thing reachable from
 * outside the package. If a future contributor edits
 * `package.json` `exports` to re-introduce a wildcard, or adds a
 * new subpath without updating the README + lint rule, this test
 * catches it before merge.
 *
 * Strategy: use Bun's runtime resolver (`import.meta.resolve`)
 * against representative internal specifiers that MUST stay
 * unresolvable from outside the package. Each one is a specifier
 * the README explicitly forbids; a regression in the exports map
 * would let one of them resolve and the test would fail.
 */

import { describe, expect, test } from 'bun:test';

const FORBIDDEN_SPECIFIERS = [
  '@gamezilla/matchmaking/matchmaker',
  '@gamezilla/matchmaking/migrate',
  '@gamezilla/matchmaking/migrate-sql',
  '@gamezilla/matchmaking/app',
  '@gamezilla/matchmaking/tick-sql',
  '@gamezilla/matchmaking/formula-wire',
  '@gamezilla/matchmaking/payload-limits',
  '@gamezilla/matchmaking/join-helpers',
  '@gamezilla/matchmaking/matchmaker-internals',
  '@gamezilla/matchmaking/index',
] as const;

const ALLOWED_SUBPATHS = [
  '@gamezilla/matchmaking',
  '@gamezilla/matchmaking/storage',
  '@gamezilla/matchmaking/wire',
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
          `The package's \`exports\` map must keep this specifier unresolvable; ` +
          `only the three subpaths in the README (\`.\`, \`./storage\`, \`./wire\`) ` +
          `may be reachable from outside the package.`
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

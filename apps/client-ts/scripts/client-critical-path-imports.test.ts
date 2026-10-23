import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  collectStaticSpecifiers,
  criticalPathViolations,
  isDeniedResolvedPath,
  isDeniedSpecifier,
  loadPathAliases,
  resolveImport,
  walkCriticalPath,
} from './client-critical-path-imports';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');

describe('client-critical-path-imports', () => {
  test('collectStaticSpecifiers skips type-only and dynamic imports', () => {
    const specs = collectStaticSpecifiers(`
      import type { Foo } from '@libs/chess/public/x';
      import { bar } from './bar';
      export { baz } from '../baz';
      import './side';
      const x = import('./lazy');
      void lazy(() => import('@libs/chess/root/y'));
    `);
    expect(specs.sort()).toEqual(['./bar', './side', '../baz'].sort());
  });

  // regression: flat-package-critical-path-boundaries
  test('allows eager product imports while excluding harness modules', () => {
    expect(isDeniedSpecifier('@libs/chess-puzzle-client-ts/x')).toBe(false);
    expect(isDeniedSpecifier('@libs/games-client-ts/game-plugins.client')).toBe(
      false
    );
    expect(
      isDeniedSpecifier(
        '@pkgs/harness-console-client-ts/product-harness-screen'
      )
    ).toBe(true);
    expect(isDeniedSpecifier('@sqlite.org/sqlite-wasm')).toBe(false);
    expect(isDeniedSpecifier('@libs/spaces-client-ts/x')).toBe(false);
  });

  test('allows eager chess and SQLite paths', () => {
    expect(
      isDeniedResolvedPath('/repo/libs/game-session-client-ts/src/board.tsx')
    ).toBe(false);
    expect(
      isDeniedResolvedPath(
        '/repo/apps/client-ts/public/sql-workers/sqlite3.wasm'
      )
    ).toBe(false);
    expect(isDeniedResolvedPath('/repo/apps/client-ts/src/main.tsx')).toBe(
      false
    );
  });

  test('resolveImport maps workspace aliases and relatives', () => {
    const root = mkdtempSync(join(tmpdir(), 'crit-path-'));
    const src = join(root, 'apps/client-ts/src');
    mkdirSync(src, { recursive: true });
    const entry = join(src, 'main.tsx');
    const child = join(src, 'child.ts');
    writeFileSync(entry, '');
    writeFileSync(child, '');
    const libDir = join(root, 'libs/spaces-client-ts/src');
    mkdirSync(libDir, { recursive: true });
    const libFile = join(libDir, 'spaces-screen.tsx');
    writeFileSync(libFile, '');

    const aliases = [
      {
        pattern: '@libs/spaces-client-ts/*',
        targets: ['libs/spaces-client-ts/src/*'],
      },
    ];
    expect(
      resolveImport({
        specifier: './child',
        fromFile: entry,
        repoRoot: root,
        aliases,
      })
    ).toBe(child);
    expect(
      resolveImport({
        specifier: '@libs/spaces-client-ts/spaces-screen',
        fromFile: entry,
        repoRoot: root,
        aliases,
      })
    ).toBe(libFile);
  });

  // regression: feedback-opfs-client-path
  test('the client resolves feedback evidence storage', () => {
    const aliases = loadPathAliases(
      join(REPO_ROOT, 'apps/client-ts/tsconfig.json')
    );
    const target = aliases
      .find((alias) => alias.pattern === '@pkgs/object-store-opfs-shared-ts/*')
      ?.targets[0]?.replace('*', 'impl-cache-api');
    expect(resolve(REPO_ROOT, 'apps/client-ts', `${target}.ts`)).toBe(
      join(REPO_ROOT, 'pkgs/object-store-opfs-shared-ts/src/impl-cache-api.ts')
    );
  });

  test('walkCriticalPath reports denylist static imports', () => {
    const root = mkdtempSync(join(tmpdir(), 'crit-walk-'));
    const src = join(root, 'apps/client-ts/src/shell');
    mkdirSync(src, { recursive: true });
    const entry = join(root, 'apps/client-ts/src/main.tsx');
    const shell = join(src, 'app.tsx');
    writeFileSync(entry, `import { App } from './shell/app';\n`);
    writeFileSync(
      shell,
      `import { ProductHarnessScreen } from '@pkgs/harness-console-client-ts/product-harness-screen';\n`
    );
    const { violations } = walkCriticalPath({
      entryAbs: entry,
      repoRoot: root,
      aliases: [],
    });
    expect(violations.length).toBeGreaterThan(0);
    expect(
      violations.some((v) => v.specifier.includes('harness-console'))
    ).toBe(true);
  });
});

/**
 * Walks the real client import graph from disk: ~3 s idle, and several times
 * that under a loaded `bun verify`, past Bun's default 5 s. The timeout is ten
 * times the idle cost so load cannot flip the verdict.
 */
const CRITICAL_PATH_WALK_TIMEOUT_MS = 30_000;

// regression: checkpoint-inline-type-import-critical-path
// Failing input: postgresRowValues returned readonly import('./types').SqlDumpValue[].
test(
  'the shipped client eagerly imports application code and excludes the harness',
  () => {
    const found = criticalPathViolations().map(
      (v) => `${v.fromRel} → ${v.specifier} (${v.reason})`
    );
    expect(found).toEqual([]);
  },
  CRITICAL_PATH_WALK_TIMEOUT_MS
);

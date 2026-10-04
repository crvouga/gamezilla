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

  test('isDeniedSpecifier matches chess / games / harness-console / wasm', () => {
    expect(isDeniedSpecifier('@libs/chess/root/client/x')).toBe(true);
    expect(isDeniedSpecifier('@libs/games/game-plugins.client')).toBe(true);
    expect(isDeniedSpecifier('@pkgs/harness-console/client')).toBe(true);
    expect(isDeniedSpecifier('@sqlite.org/sqlite-wasm')).toBe(true);
    expect(isDeniedSpecifier('@libs/spaces/root/client/x')).toBe(false);
  });

  test('isDeniedResolvedPath matches chess and sql-workers paths', () => {
    expect(
      isDeniedResolvedPath('/repo/libs/chess/src/root/client/board.tsx')
    ).toBe(true);
    expect(
      isDeniedResolvedPath('/repo/apps/client/public/sql-workers/sqlite3.wasm')
    ).toBe(true);
    expect(isDeniedResolvedPath('/repo/apps/client/src/main.tsx')).toBe(false);
  });

  test('resolveImport maps workspace aliases and relatives', () => {
    const root = mkdtempSync(join(tmpdir(), 'crit-path-'));
    const src = join(root, 'apps/client/src');
    mkdirSync(src, { recursive: true });
    const entry = join(src, 'main.tsx');
    const child = join(src, 'child.ts');
    writeFileSync(entry, '');
    writeFileSync(child, '');
    const libDir = join(root, 'libs/spaces/src/root/client');
    mkdirSync(libDir, { recursive: true });
    const libFile = join(libDir, 'spaces-screen.tsx');
    writeFileSync(libFile, '');

    const aliases = [
      {
        pattern: '@libs/spaces/*',
        targets: ['libs/spaces/src/*'],
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
        specifier: '@libs/spaces/root/client/spaces-screen',
        fromFile: entry,
        repoRoot: root,
        aliases,
      })
    ).toBe(libFile);
  });

  // regression: feedback-opfs-client-path
  test('the client resolves feedback evidence storage', () => {
    const aliases = loadPathAliases(
      join(REPO_ROOT, 'apps/client/tsconfig.json')
    );
    const target = aliases
      .find((alias) => alias.pattern === '@pkgs/object-store-opfs-shared/*')
      ?.targets[0]?.replace('*', 'impl-cache-api');
    expect(resolve(REPO_ROOT, 'apps/client', `${target}.ts`)).toBe(
      join(REPO_ROOT, 'pkgs/object-store-opfs-shared/src/impl-cache-api.ts')
    );
  });

  test('walkCriticalPath reports denylist static imports', () => {
    const root = mkdtempSync(join(tmpdir(), 'crit-walk-'));
    const src = join(root, 'apps/client/src/shell');
    mkdirSync(src, { recursive: true });
    const entry = join(root, 'apps/client/src/main.tsx');
    const shell = join(src, 'app.tsx');
    writeFileSync(entry, `import { App } from './shell/app';\n`);
    writeFileSync(
      shell,
      `import { GAME_DEFINITIONS } from '@libs/games/game-plugins.client';\n`
    );
    const { violations } = walkCriticalPath({
      entryAbs: entry,
      repoRoot: root,
      aliases: [],
    });
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.specifier.includes('game-plugins'))).toBe(
      true
    );
  });
});

/**
 * Walks the real client import graph from disk: ~3 s idle, and several times
 * that under a loaded `bun check`, past Bun's default 5 s. The timeout is ten
 * times the idle cost so load cannot flip the verdict.
 */
const CRITICAL_PATH_WALK_TIMEOUT_MS = 30_000;

test(
  'the shipped client keeps heavy modules off the critical path',
  () => {
    const found = criticalPathViolations().map(
      (v) => `${v.fromRel} → ${v.specifier} (${v.reason})`
    );
    expect(found).toEqual([]);
  },
  CRITICAL_PATH_WALK_TIMEOUT_MS
);

import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  collectStaticSpecifiers,
  criticalPathViolations,
  isDeniedResolvedPath,
  isDeniedSpecifier,
  resolveImport,
  walkCriticalPath,
} from './client-critical-path-imports';

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

  test('isDeniedSpecifier matches chess / games / sim-console / wasm', () => {
    expect(isDeniedSpecifier('@libs/chess/root/client/x')).toBe(true);
    expect(isDeniedSpecifier('@libs/games/game-plugins.client')).toBe(true);
    expect(isDeniedSpecifier('@pkgs/sim-console/client')).toBe(true);
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

test('the shipped client keeps heavy modules off the critical path', () => {
  const found = criticalPathViolations().map(
    (v) => `${v.fromRel} → ${v.specifier} (${v.reason})`
  );
  expect(found).toEqual([]);
});

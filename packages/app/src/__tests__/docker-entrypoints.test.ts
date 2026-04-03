/**
 * Validates that every @gamezilla/* import in the Docker-deployed entry points
 * resolves correctly. Catches tsconfig path and package.json exports breakage
 * during `turbo check` — long before ECS tries to run the container.
 */
// eslint-disable-next-line import/no-unresolved
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ENTRYPOINTS = ['src/req-res.ts', 'src/worker.ts'] as const;

const WORKSPACE_IMPORT_RE = /from\s+['"](@gamezilla\/[^'"]+)['"]/g;

function extractWorkspaceImports(filePath: string): string[] {
  const src = readFileSync(filePath, 'utf-8');
  const imports: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = WORKSPACE_IMPORT_RE.exec(src)) !== null) {
    const spec = m[1];
    if (spec) {
      imports.push(spec);
    }
  }
  return imports;
}

describe('Docker entrypoint module resolution', () => {
  for (const ep of ENTRYPOINTS) {
    const absPath = join(__dirname, '..', '..', ep);

    test(`${ep} — all @gamezilla/* imports resolve`, () => {
      const imports = extractWorkspaceImports(absPath);
      expect(imports.length).toBeGreaterThan(0);

      const failures: string[] = [];
      for (const spec of imports) {
        try {
          require.resolve(spec);
        } catch {
          failures.push(spec);
        }
      }

      if (failures.length > 0) {
        throw new Error(
          `${ep}: ${failures.length} import(s) failed to resolve:\n` +
            failures.map((f) => `  - ${f}`).join('\n') +
            '\n\nThis means the Docker container will crash on startup.\n' +
            'Common causes:\n' +
            '  1. packages/app/tsconfig.json defines its own `paths` alongside `extends`\n' +
            '     (Bun silently ignores child paths when extends is used)\n' +
            '  2. Package.json `exports` pattern is incompatible with Bun\n' +
            '  3. A workspace package was renamed/moved without updating imports'
        );
      }
    });
  }
});

describe('tsconfig safety (Bun extends bug guard)', () => {
  test('packages/app/tsconfig.json must not define paths when using extends', () => {
    const tsconfigPath = join(__dirname, '..', '..', 'tsconfig.json');
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf-8'));

    if (tsconfig.extends) {
      const hasPaths =
        tsconfig.compilerOptions?.paths !== undefined &&
        Object.keys(tsconfig.compilerOptions.paths).length > 0;

      expect(hasPaths).toBe(false);

      if (hasPaths) {
        throw new Error(
          'packages/app/tsconfig.json has both `extends` and `compilerOptions.paths`.\n' +
            'Bun has a bug where child tsconfig paths are silently dropped when extends is used.\n' +
            'Fix: Remove `paths` from packages/app/tsconfig.json — the root tsconfig already has them.'
        );
      }
    }
  });

  test('root tsconfig.json has paths for all workspace packages', () => {
    const rootTsconfigPath = join(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'tsconfig.json'
    );
    const rootTsconfig = JSON.parse(readFileSync(rootTsconfigPath, 'utf-8'));
    const paths = rootTsconfig.compilerOptions?.paths ?? {};

    const requiredPrefixes = [
      '@gamezilla/shared/*',
      '@gamezilla/patch-db/*',
      '@gamezilla/peer-store/*',
    ];

    for (const prefix of requiredPrefixes) {
      expect(paths[prefix]).toBeDefined();
    }
  });
});

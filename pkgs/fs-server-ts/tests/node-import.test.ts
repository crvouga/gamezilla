import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = join(import.meta.dirname, '../src');

// Vite loads `vite.config.mts` with Node, which resolves a relative import
// only with its extension. A bare `./lock-retry` broke every product build.
test('every module loads under Node, which needs explicit extensions', () => {
  for (const file of readdirSync(SRC).filter((name) => name.endsWith('.ts'))) {
    const run = spawnSync(
      'node',
      ['-e', `import(${JSON.stringify(pathToFileURL(join(SRC, file)).href)})`],
      { encoding: 'utf8' }
    );
    expect(run.stderr, file).not.toContain('ERR_MODULE_NOT_FOUND');
    expect(run.status, `${file}: ${run.stderr}`).toBe(0);
  }
});

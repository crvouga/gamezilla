import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const SRC = join(import.meta.dirname, '../src');

// regression: identity-module-not-node-loadable
// Vite loads `vite.config.mts` with Node (`brandHtmlPlugin`), which resolves
// a relative import only with its extension and imports JSON only with a
// `type: 'json'` attribute. Either one missing broke `vite build`.
test('every module loads under Node, which needs extensions and JSON attributes', () => {
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

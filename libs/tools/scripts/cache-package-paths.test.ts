import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '../../..');
type Config = {
  tasks: Record<string, { inputs?: string[]; dependsOn?: string[] }>;
};

// regression: flattened-checker-cache-dependencies
test('cache inputs reference existing package owners after package splits', () => {
  const paths = [
    'turbo.json',
    ...new Bun.Glob('{apps,libs,pkgs}/*/turbo.json').scanSync({ cwd: ROOT }),
  ];
  for (const path of paths) {
    const config = JSON.parse(readFileSync(join(ROOT, path), 'utf8')) as Config;
    for (const [task, definition] of Object.entries(config.tasks)) {
      for (const input of definition.inputs ?? []) {
        const owner =
          /^!?\$TURBO_ROOT\$\/((?:apps|libs|pkgs)\/[^/*?{]+)\//.exec(
            input
          )?.[1];
        if (owner)
          expect(
            existsSync(join(ROOT, owner, 'package.json')),
            `${path}: ${task}: ${input}`
          ).toBe(true);
      }
    }
  }
});

// regression: flattened-checker-cache-dependencies
test('model verdicts depend on the split checker and evidence implementations', () => {
  const config = JSON.parse(
    readFileSync(join(ROOT, 'turbo.json'), 'utf8')
  ) as Config;
  expect(config.tasks['verify:models']!.dependsOn).toEqual([
    '@pkgs/quint-server#src',
    '@pkgs/quint-shared#src',
    '@pkgs/conformance-server#src',
    '@pkgs/conformance-shared#src',
  ]);
});

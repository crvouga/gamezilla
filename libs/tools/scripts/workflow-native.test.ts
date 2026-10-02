import { expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../../..');

// regression: depot-native-ci-runner-routing
test('only native Depot owns Check, Deploy and Health triggers', () => {
  expect(readdirSync(join(ROOT, '.depot/workflows')).sort()).toEqual([
    'check.yml',
    'deploy.yml',
    'health.yml',
  ]);
  const github = join(ROOT, '.github/workflows');
  expect(
    existsSync(github)
      ? readdirSync(github).filter((file) => /\.ya?ml$/.test(file))
      : []
  ).toEqual([]);
});

// regression: depot-native-ci-missing-local-action
test('every native local action reference has a committed manifest, including nested actions', () => {
  const pending = readdirSync(join(ROOT, '.depot/workflows')).map((file) =>
    join(ROOT, '.depot/workflows', file)
  );
  const visited = new Set<string>();
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/uses: (\.\/[^\s]+)/g)) {
      const directory = match[1]!;
      expect(directory.startsWith('./.depot/actions/')).toBe(true);
      const manifests = ['action.yml', 'action.yaml'].map((name) =>
        join(ROOT, directory, name)
      );
      const manifest = manifests.find((path) => existsSync(path));
      expect(manifest, directory).toBeDefined();
      if (manifest !== undefined) pending.push(manifest);
    }
  }
});

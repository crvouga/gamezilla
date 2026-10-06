import { expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../../..');

// regression: ci-provider-native-ci-runner-routing
test('only GitHub Actions owns Check, Deploy and Health triggers', () => {
  expect(readdirSync(join(ROOT, '.github/workflows')).sort()).toEqual([
    'check.yml',
    'deploy.yml',
    'health.yml',
  ]);
  for (const file of readdirSync(join(ROOT, '.github/workflows'))) {
    const workflow = Bun.YAML.parse(
      readFileSync(join(ROOT, '.github/workflows', file), 'utf8')
    ) as {
      jobs: Record<string, { 'runs-on': string }>;
    };
    for (const job of Object.values(workflow.jobs)) {
      expect(job['runs-on']).toBe('ubuntu-24.04');
    }
  }
});

// regression: ci-provider-native-ci-missing-local-action
test('every native local action reference has a committed manifest, including nested actions', () => {
  const pending = readdirSync(join(ROOT, '.github/workflows')).map((file) =>
    join(ROOT, '.github/workflows', file)
  );
  const visited = new Set<string>();
  while (pending.length > 0) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/uses: (\.\/[^\s]+)/g)) {
      const directory = match[1]!;
      expect(directory.startsWith('./.github/actions/')).toBe(true);
      const manifests = ['action.yml', 'action.yaml'].map((name) =>
        join(ROOT, directory, name)
      );
      const manifest = manifests.find((path) => existsSync(path));
      expect(manifest, directory).toBeDefined();
      if (manifest !== undefined) pending.push(manifest);
    }
  }
});

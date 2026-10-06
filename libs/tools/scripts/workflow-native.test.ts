import { expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { testConcurrency } from '@pkgs/os-server/test-concurrency';

const ROOT = join(import.meta.dirname, '../../..');

// regression: github-check-test-concurrency-oversubscription
test('a two-core Check runner never starts twenty concurrent test processes', () => {
  const workflow = Bun.YAML.parse(
    readFileSync(join(ROOT, '.github/workflows/check.yml'), 'utf8')
  ) as { env: Record<string, string | number> };
  const env = {
    CHECK_TEST_CONCURRENCY: String(workflow.env['CHECK_TEST_CONCURRENCY']),
  };
  expect(testConcurrency(env, 20)).toBe(1);
  expect(testConcurrency(env, 2)).toBe(1);
  expect(workflow.env['CHECK_CONCURRENCY']).toEndWith("|| '1' }}");
});

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

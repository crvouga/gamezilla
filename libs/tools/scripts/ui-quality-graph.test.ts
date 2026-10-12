import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { testConcurrency } from '@pkgs/os-server/test-concurrency';
import { specPackages } from './spec-packages';
import { MAIN_CHECK_TASKS } from './turbo-ci-run';

const ROOT = join(import.meta.dir, '../../..');
const readJson = <T>(file: string): T =>
  JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as T;

test('the product proof starts bounded solver workers before native replay', () => {
  // regression: product-symbolic-worker-contention — 13 concurrent JVM checks starved whole-system at its unchanged 120s deadline.
  const pkg = readJson<{ scripts: Record<string, string> }>(
    'apps/product/package.json'
  );
  const stages = pkg.scripts['test:contract']!.split(' && ');
  expect(stages).toHaveLength(2);
  expect(stages[0]).toContain('tests/quint/model-checks.test.ts');
  expect(stages[1]).toContain('tests/ui-quality-render.contract.test.ts');
  for (const stage of stages) {
    const ceiling = stage.match(/--max-concurrency=\$\(bun [^ ]+ (\d+)\)/)?.[1];
    expect(ceiling).toBeDefined();
    for (const limit of [undefined, '1', '2', '8']) {
      const workers = testConcurrency(
        { CHECK_TEST_CONCURRENCY: limit },
        Number(ceiling)
      );
      expect(workers).toBeGreaterThan(0);
      expect(workers).toBeLessThanOrEqual(2);
    }
  }
});

test('the visual gate consumes every product spec part and caches both verdict and published evidence', () => {
  const owners = specPackages().filter(
    (p) => !p.dir.startsWith('pkgs/') && p.specDomains.length > 0
  );
  const sources = readJson<
    readonly { package: string; directory: string; parts: number }[]
  >('apps/product/scripts/ui-quality/sources.json');
  expect(sources.map((s) => s.directory).sort()).toEqual(
    owners.map((p) => p.dir).sort()
  );
  const expected = owners.flatMap((owner) => {
    const pkg = readJson<{ specParts: number }>(`${owner.dir}/package.json`);
    expect(sources.find((s) => s.package === owner.name)?.parts).toBe(
      pkg.specParts
    );
    return Array.from(
      { length: pkg.specParts },
      (_, n) => `${owner.name}#test:spec:${n}`
    );
  });
  const turbo = readJson<{
    tasks: Record<string, { dependsOn: string[]; outputs: string[] }>;
  }>('apps/product/turbo.json');
  expect(turbo.tasks['prepare:ui-quality']!.dependsOn.sort()).toEqual(
    expected.sort()
  );
  expect(turbo.tasks['check:ui-quality']!.dependsOn).toContain(
    'prepare:ui-quality'
  );
  expect(turbo.tasks['check:ui-quality']!.dependsOn).toContain(
    '@pkgs/ui-quality-check-server#build'
  );
  expect(turbo.tasks['check:ui-quality']!.outputs).toContain(
    '.cache/ui-quality/**'
  );
  expect(turbo.tasks['check:ui-quality']!.outputs).toContain(
    '.cache/harness-report/ui-quality/**'
  );
});

// regression: ui-quality-model-cache-payload-limit — the 351 MB model upload returned HTTP 413.
test('explicit model setup does not submit an oversized cache artifact or download inside the offline gate', () => {
  const turbo = readJson<{
    tasks: Record<
      string,
      {
        cache?: boolean;
        outputs?: readonly string[];
        dependsOn?: readonly string[];
      }
    >;
  }>('apps/product/turbo.json');
  const setup = turbo.tasks['prepare:ui-quality-model']!;
  expect(setup.cache).toBe(false);
  expect(setup.outputs).toEqual([]);
  expect(turbo.tasks['check:ui-quality']!.dependsOn).not.toContain(
    'prepare:ui-quality-model'
  );
});

// regression: ui-quality-inference-quint-contention — the two-transition safety check exceeded 120 seconds with inference running.
test('native inference waits for the existing product symbolic and renderer contracts', () => {
  const turbo = readJson<{ tasks: Record<string, { dependsOn?: string[] }> }>(
    'apps/product/turbo.json'
  );
  expect(turbo.tasks['check:ui-quality']!.dependsOn).toContain('test:contract');
});

test('release Check and Deploy never run the visual gate or prepare its model', () => {
  const turbo = readJson<{ tasks: Record<string, { dependsOn?: string[] }> }>(
    'turbo.json'
  );
  expect(MAIN_CHECK_TASKS).not.toContain('@apps/product#check:ui-quality');
  expect(turbo.tasks['@apps/product#deploy']!.dependsOn).not.toContain(
    '@apps/product#check:ui-quality'
  );
  for (const name of ['check', 'deploy'])
    expect(
      readFileSync(join(ROOT, '.github/workflows', `${name}.yml`), 'utf8')
    ).not.toContain('ui-quality');
});

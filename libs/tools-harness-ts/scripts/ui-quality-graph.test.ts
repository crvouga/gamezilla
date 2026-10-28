import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { testConcurrency } from '@pkgs/os-server-ts/test-concurrency';
import { specPackages } from './spec-packages';
import { MAIN_VERIFY_TASKS } from './turbo-ci-run';

const ROOT = join(import.meta.dir, '../../..');
const readJson = <T>(file: string): T =>
  JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as T;

test('the product proof starts bounded solver workers before native replay', () => {
  // regression: product-symbolic-worker-contention — 13 concurrent JVM verifications starved whole-system at its unchanged 120s deadline.
  const pkg = readJson<{ scripts: Record<string, string> }>(
    'apps/product-ts/package.json'
  );
  const parts = Object.keys(pkg.scripts)
    .filter((name) => /^test:contract:\d+$/.test(name))
    .sort();
  const render = pkg.scripts['test:contract:render']!;
  expect(parts.length).toBeGreaterThan(0);
  expect(pkg.scripts['test:contract']).toBeUndefined();
  for (const name of parts) {
    expect(pkg.scripts[name]).toContain('tests/quint/model-checks.test.ts');
    expect(pkg.scripts[name]).not.toContain('ui-quality-render');
  }
  expect(render).toContain('tests/ui-quality-render.contract.test.ts');
  const turboFile = readJson<{
    tasks: Record<string, { dependsOn?: readonly string[] }>;
  }>('apps/product-ts/turbo.json');
  // Parts are dedicated solver runners. The renderer must not depend on them,
  // or the shard grouper would put every proof back on one machine.
  const renderDeps = turboFile.tasks['test:contract:render']!.dependsOn ?? [];
  expect(renderDeps.some((dep) => dep.startsWith('test:contract'))).toBe(false);
  for (const stage of [...parts.map((name) => pkg.scripts[name]!), render]) {
    const ceiling = stage.match(/--max-concurrency=\$\(bun [^ ]+ (\d+)\)/)?.[1];
    expect(ceiling).toBeDefined();
    for (const limit of [undefined, '1', '2', '8']) {
      const workers = testConcurrency(
        { VERIFY_TEST_CONCURRENCY: limit },
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
  >('apps/product-ts/scripts/ui-quality/sources.json');
  // regression: pong-visual-evidence-not-enrolled — its declared spec package was missing here.
  expect(
    sources.some((source) => source.directory === 'libs/pong-harness-ts')
  ).toBe(true);
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
  }>('apps/product-ts/turbo.json');
  expect(turbo.tasks['prepare:ui-quality']!.dependsOn.sort()).toEqual(
    expected.sort()
  );
  expect(turbo.tasks['verify:ui-quality']!.dependsOn).toContain(
    'prepare:ui-quality'
  );
  expect(turbo.tasks['verify:ui-quality']!.dependsOn).toContain(
    '@pkgs/ui-quality-check-server-ts#build'
  );
  expect(turbo.tasks['verify:ui-quality']!.outputs).toContain(
    '.cache/ui-quality/**'
  );
  expect(turbo.tasks['verify:ui-quality']!.outputs).toContain(
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
  }>('apps/product-ts/turbo.json');
  const setup = turbo.tasks['prepare:ui-quality-model']!;
  expect(setup.cache).toBe(false);
  expect(setup.outputs).toEqual([]);
  expect(turbo.tasks['verify:ui-quality']!.dependsOn).not.toContain(
    'prepare:ui-quality-model'
  );
});

// regression: ui-quality-inference-quint-contention — the two-transition safety verification exceeded 120 seconds with inference running.
test('native inference waits for the existing product symbolic and renderer contracts', () => {
  const turbo = readJson<{ tasks: Record<string, { dependsOn?: string[] }> }>(
    'apps/product-ts/turbo.json'
  );
  const parts = Object.keys(
    readJson<{ scripts: Record<string, string> }>(
      'apps/product-ts/package.json'
    ).scripts
  ).filter((name) => /^test:contract:\d+$/.test(name));
  for (const name of parts) {
    expect(turbo.tasks['verify:ui-quality']!.dependsOn).toContain(name);
  }
  expect(turbo.tasks['verify:ui-quality']!.dependsOn).toContain(
    'test:contract:render'
  );
});

test('release Verify and Release never run the visual gate or prepare its model', () => {
  const turbo = readJson<{ tasks: Record<string, { dependsOn?: string[] }> }>(
    'turbo.json'
  );
  expect(MAIN_VERIFY_TASKS).not.toContain('@apps/product-ts#verify:ui-quality');
  expect(turbo.tasks['@apps/product-ts#deploy']!.dependsOn).not.toContain(
    '@apps/product-ts#verify:ui-quality'
  );
  for (const name of ['verify-pr', 'deploy'])
    expect(
      readFileSync(join(ROOT, '.github/workflows', `${name}.yml`), 'utf8')
    ).not.toContain('ui-quality');
});

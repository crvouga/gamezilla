import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { specPackages } from './spec-packages';

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
  expect(stages[0]).toContain('tests/quint/system/model-checks.test.ts');
  expect(stages[1]).toContain('tests/ui-quality-render.contract.test.ts');
  for (const stage of stages) {
    const workers = stage.match(/--max-concurrency (\d+)/)?.[1];
    expect(workers).toBeDefined();
    expect(Number(workers)).toBeGreaterThan(0);
    expect(Number(workers)).toBeLessThanOrEqual(2);
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
    'ui-quality-check#build'
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

// regression: ui-quality-deploy-order — aggregator siblings allowed publication before the visual verdict.
test('product publication requires the visual gate to pass', () => {
  const turbo = readJson<{ tasks: Record<string, { dependsOn?: string[] }> }>(
    'turbo.json'
  );
  expect(turbo.tasks['@apps/product#deploy']!.dependsOn).toContain(
    '@apps/product#check:ui-quality'
  );
});

test('sharded Check prepares visual inference while deploys retain their measured runner', () => {
  type Workflow = {
    jobs: Record<
      string,
      {
        'runs-on': string;
        env?: Record<string, string>;
        steps: {
          name?: string;
          uses?: string;
          run?: string;
          with?: Record<string, string>;
        }[];
      }
    >;
  };
  const workflow = (name: string) =>
    Bun.YAML.parse(
      readFileSync(join(ROOT, '.depot/workflows', `${name}.yml`), 'utf8')
    ) as Workflow;
  const check = workflow('check');
  const deploy = workflow('deploy');
  const shard = check.jobs['check-shards']!;
  expect(shard['runs-on']).toContain('vars.CHECK_RUNNER');
  expect(
    shard.steps.find((step) => step.uses === './.depot/actions/setup')?.with?.[
      'ui-quality'
    ]
  ).toBe('true');
  const setupIndex = shard.steps.findIndex(
    (step) => step.name === 'Prepare visual model for its owning shard'
  );
  const checkIndex = shard.steps.findIndex((step) => step.name === 'check');
  expect(setupIndex).toBeGreaterThanOrEqual(0);
  expect(setupIndex).toBeLessThan(checkIndex);
  expect(shard.steps[setupIndex]!.run).toContain(
    '@apps/product#check:ui-quality'
  );
  expect(shard.steps[setupIndex]!.run).toContain(
    '@apps/product#prepare:ui-quality-model'
  );
  const evidence = shard.steps.find(
    (step) => step.name === 'Upload visual quality evidence'
  );
  expect(evidence?.with?.['name']).toContain('${{ matrix.shard }}');
  expect(evidence?.with?.['path']).toBe('apps/product/.cache/ui-quality/');
  for (const name of ['deploy-standard', 'deploy-production']) {
    expect(deploy.jobs[name]!['runs-on']).toBe('depot-ubuntu-24.04-16');
    expect(deploy.jobs[name]!.env?.['TURBO_CONCURRENCY']).toBe('12');
  }
});

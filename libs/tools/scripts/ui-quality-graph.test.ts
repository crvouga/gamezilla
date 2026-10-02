import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { specPackages } from './spec-packages';

const ROOT = join(import.meta.dir, '../../..');
const readJson = <T>(file: string): T =>
  JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as T;

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

test('environment deploys use the same measured visual runner as Check', () => {
  type Workflow = {
    jobs: Record<string, { 'runs-on': string; env?: Record<string, string> }>;
  };
  const workflow = (name: string) =>
    Bun.YAML.parse(
      readFileSync(join(ROOT, '.depot/workflows', `${name}.yml`), 'utf8')
    ) as Workflow;
  const check = workflow('check');
  const deploy = workflow('deploy');
  for (const name of ['deploy-standard', 'deploy-production']) {
    expect(deploy.jobs[name]!['runs-on']).toBe(check.jobs['check']!['runs-on']);
    expect(deploy.jobs[name]!.env?.['TURBO_CONCURRENCY']).toBe('12');
  }
});

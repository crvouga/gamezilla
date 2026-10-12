import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../../..');

// regression: check-cache-write-only-override
test('Check enforces read/write after secrets injection', () => {
  const workflow = readFileSync(
    join(root, '.github/workflows/check.yml'),
    'utf8'
  );
  expect(workflow).toContain(
    'secrets-run.ts -- env TURBO_CACHE=local:rw,remote:rw TURBO_CONCURRENCY='
  );
});

// regression: ci-provider-api-dependency-cache-ref
test('setup installs frozen dependencies whether or not the dependency cache answers', () => {
  const source = readFileSync(
    join(root, '.github/actions/setup/action.yml'),
    'utf8'
  );
  const setup = Bun.YAML.parse(source) as {
    runs: {
      steps: {
        name?: string;
        if?: string;
        uses?: string;
        run?: string;
        with?: Record<string, string>;
      }[];
    };
  };
  const steps = setup.runs.steps;
  const install = steps.findIndex(
    (step) => step.run === 'bun install --frozen-lockfile'
  );
  expect(install).toBeGreaterThan(-1);
  expect(steps[install]!.if).toBeUndefined();
  expect(source).toContain('uses: jdx/mise-action@v4');
  // The cache is an exact, content-only key: no ref, no fallback to the
  // trees of another lockfile.
  expect(source).not.toMatch(/github\.(ref|head_ref|base_ref)|GITHUB_REF/);
  const caches = steps.filter((step) => step.uses?.startsWith('actions/cache'));
  expect(caches.map((step) => step.uses)).toEqual([
    'actions/cache/restore@v5',
    'actions/cache/save@v5',
  ]);
  const [restore, save] = caches as [
    (typeof steps)[number],
    (typeof steps)[number],
  ];
  expect(restore.with!['restore-keys']).toBeUndefined();
  expect(restore.with!['fail-on-cache-miss']).toBeUndefined();
  expect(restore.with!['key']).toContain(
    "hashFiles('bun.lock', 'mise.toml', '.github/actions/setup/action.yml')"
  );
  expect(save.with!['path']).toBe(restore.with!['path']!);
  // Restored before the install checks the trees, saved after it built them.
  expect(steps.indexOf(restore)).toBeLessThan(install);
  expect(steps.indexOf(save)).toBeGreaterThan(install);
  expect(save.if).toBe("steps.dependencies.outputs.cache-hit != 'true'");
});

// regression: ci-submodule-workspace-not-initialized
test('setup initializes workspace submodules before installing dependencies', () => {
  const setup = readFileSync(
    join(root, '.github/actions/setup/action.yml'),
    'utf8'
  );
  const initializeSubmodules = setup.indexOf(
    'git submodule update --init --recursive'
  );
  const installDependencies = setup.indexOf('bun install --frozen-lockfile');
  expect(initializeSubmodules).toBeGreaterThan(-1);
  expect(initializeSubmodules).toBeLessThan(installDependencies);
});

// regression: turbo-build-unhashed-inputs
test('build hashes its toolchain, shared compiler configs and output-affecting env', () => {
  const turbo = JSON.parse(readFileSync(join(root, 'turbo.json'), 'utf8')) as {
    globalDependencies: string[];
    tasks: {
      build: { env: string[]; inputs: string[] };
      '@apps/product#check:offline-shell': {
        inputs: string[];
        dependsOn: string[];
      };
    };
  };
  expect(turbo.globalDependencies).toContain('mise.toml');
  // Vite embeds the entire public env object for import.meta.env reads.
  for (const name of ['VITE_*', 'ANALYZE']) {
    expect(turbo.tasks.build.env).toContain(name);
  }
  for (const file of [
    'package.json',
    'lingui.config.ts',
    'lingui.solid.config.ts',
  ]) {
    expect(turbo.tasks.build.inputs).toContain(`$TURBO_ROOT$/${file}`);
  }
  for (const input of ['**/*.po', '**/*.mts', '.env.local']) {
    expect(turbo.tasks.build.inputs).toContain(input);
  }
  expect(turbo.tasks['@apps/product#check:offline-shell'].dependsOn).toContain(
    '@apps/product#build'
  );
  expect(turbo.tasks['@apps/product#check:offline-shell'].inputs).not.toContain(
    'dist/**'
  );
});

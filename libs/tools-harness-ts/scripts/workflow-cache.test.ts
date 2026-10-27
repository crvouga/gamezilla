import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../../..');

// regression: verify-cache-write-only-override
test('Verification enforces read/write after secrets injection', () => {
  const workflow = readFileSync(
    join(root, '.github/workflows/verify-pr.yml'),
    'utf8'
  );
  expect(workflow).toContain(
    'secrets-run.ts -- env TURBO_CACHE=local:rw,remote:rw TURBO_CONCURRENCY='
  );
});

// regression: ci-provider-api-dependency-cache-ref
// regression: windows-dependency-tree-cache-eperm
test('setup installs frozen dependencies on every run and never archives the linked trees', () => {
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
  // No cache key depends on the ref.
  expect(source).not.toMatch(/github\.(ref|head_ref|base_ref)|GITHUB_REF/);
  // bun links packages into node_modules; an archive of those links did not
  // survive Windows (Git's tar restored them unreadable, EPERM), so no OS
  // caches the trees and every run links them from bun's own cache.
  expect(
    steps.filter(
      (step) =>
        step.uses?.startsWith('actions/cache') &&
        step.with?.['path']?.includes('node_modules')
    )
  ).toEqual([]);
});

// regression: windows-ci-installs-agent-tools
test('setup never installs the laptop-only coding-agent tools', () => {
  const source = readFileSync(
    join(root, '.github/actions/setup/action.yml'),
    'utf8'
  );
  const mise = readFileSync(join(root, 'mise.toml'), 'utf8');
  const disabled = /MISE_DISABLE_TOOLS=([^"\s]+)/.exec(source)?.[1];
  expect(disabled?.split(',')).toEqual(['pipx:graphifyy', 'pipx:serena-agent']);
  for (const tool of disabled!.split(',')) expect(mise).toContain(`"${tool}"`);
});

test('setup reuses generation artifacts separately while retaining frozen dependency validation', () => {
  const setup = Bun.YAML.parse(
    readFileSync(join(root, '.github/actions/setup/action.yml'), 'utf8')
  ) as {
    runs: {
      steps: {
        uses?: string;
        run?: string;
        if?: string;
        env?: Record<string, string>;
        with?: Record<string, string>;
      }[];
    };
  };
  const steps = setup.runs.steps;
  const restore = steps.findIndex(
    (step) =>
      step.uses?.startsWith('actions/cache/restore') &&
      step.with?.['path'] === '.cache/setup-generation'
  );
  const install = steps.findIndex(
    (step) => step.run === 'bun install --frozen-lockfile'
  );
  const save = steps.findIndex(
    (step) =>
      step.uses?.startsWith('actions/cache/save') &&
      step.with?.['path'] === '.cache/setup-generation'
  );
  expect(restore).toBeGreaterThan(-1);
  expect(restore).toBeLessThan(install);
  expect(save).toBeGreaterThan(install);
  expect(steps[install]!.env?.['TURBO_CACHE_DIR']).toBe(
    '.cache/setup-generation'
  );
  expect(steps[install]!.if).toBeUndefined();
  expect(steps[save]!.if).toBe("steps.generation.outputs.cache-hit != 'true'");
});

// regression: turbo-build-unhashed-inputs
test('build hashes its toolchain, shared compiler configs and output-affecting env', () => {
  const turbo = JSON.parse(readFileSync(join(root, 'turbo.json'), 'utf8')) as {
    globalDependencies: string[];
    tasks: {
      build: { env: string[]; inputs: string[] };
      '@apps/product-ts#verify:offline-shell': {
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
  expect(
    turbo.tasks['@apps/product-ts#verify:offline-shell'].dependsOn
  ).toContain('@apps/product-ts#build');
  expect(
    turbo.tasks['@apps/product-ts#verify:offline-shell'].inputs
  ).not.toContain('dist/**');
});

import { expect, test } from 'bun:test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../../..');

// regression: nightly-random-nested-worker-contention
test('randomized suites own the runner one worker pool at a time', () => {
  const workflow = Bun.YAML.parse(
    readFileSync(join(root, '.github/workflows/verify-nightly.yml'), 'utf8')
  ) as {
    jobs: Record<
      string,
      { steps: { name?: string; env?: Record<string, string> }[] }
    >;
  };
  const random = workflow.jobs['verify-nightly-random']!.steps.find(
    (step) => step.name === 'verify-nightly:random'
  );
  expect(random?.env?.['TURBO_CONCURRENCY']).toBe('1');
  expect(random?.env?.['PBT_CONCURRENCY']).toBe('1');
});

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
// regression: mise-action-upgrade-stale-version-contract
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
  expect(source).toMatch(/uses: jdx\/mise-action@[0-9a-f]{40} # v5\./);
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
test('setup never installs the laptop-only coding-agent tools or Swift', () => {
  const source = readFileSync(
    join(root, '.github/actions/setup/action.yml'),
    'utf8'
  );
  const mise = readFileSync(join(root, 'mise.toml'), 'utf8');
  const disabled = /MISE_DISABLE_TOOLS=([^"\s]+)/.exec(source)?.[1];
  expect(disabled?.split(',')).toEqual([
    'pipx:graphifyy',
    'pipx:serena-agent',
    'swift',
  ]);
  // Each names a tool mise.toml pins, quoted or bare.
  for (const tool of disabled!.split(','))
    expect(
      mise.includes(`"${tool}"`) || new RegExp(`^${tool} = `, 'm').test(mise)
    ).toBe(true);
});

test('setup installs with no secret in the environment, restoring generation from a GitHub cache', () => {
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
  const inject = steps.findIndex(
    (step) => step.uses === './.github/actions/secrets-auth'
  );
  // Dependency install scripts and the postinstall generation run before any
  // secret is in the environment, so they never see a credential; secrets
  // come in only after the install.
  expect(inject).toBeGreaterThan(-1);
  expect(inject).toBeGreaterThan(save);
  expect(steps[inject]!.if).toBe("inputs.secrets-environment != ''");
  // Without TURBO_TOKEN the install's generation keeps the GitHub cache.
  expect(restore).toBeGreaterThan(-1);
  expect(restore).toBeLessThan(install);
  expect(save).toBeGreaterThan(install);
  expect(steps[restore]!.if).toBeUndefined();
  expect(steps[install]!.env?.['TURBO_CACHE_DIR']).toBe(
    '.cache/setup-generation'
  );
  expect(steps[install]!.if).toBeUndefined();
  expect(steps[save]!.if).toBe("steps.generation.outputs.cache-hit != 'true'");
});

test('every job that injects secrets does it in setup, after the install', () => {
  for (const file of [
    'deploy.yml',
    'health.yml',
    'verify-nightly.yml',
    'verify-pr.yml',
  ]) {
    const text = readFileSync(join(root, '.github/workflows', file), 'utf8');
    expect(text).not.toContain('uses: ./.github/actions/secrets-auth');
  }
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

const WORKFLOW_FILES = [
  'deploy.yml',
  'health.yml',
  'verify-nightly.yml',
  'verify-pr.yml',
];

/** Every env name a task's `env` hashes, from the root and package configs. */
function hashedEnvNames(): Set<string> {
  const names = new Set<string>();
  const configs = [
    join(root, 'turbo.json'),
    ...['apps', 'libs', 'pkgs'].flatMap((group) =>
      readdirSync(join(root, group)).map((name) =>
        join(root, group, name, 'turbo.json')
      )
    ),
  ];
  for (const path of configs) {
    if (!existsSync(path)) continue;
    const turbo = JSON.parse(readFileSync(path, 'utf8')) as {
      tasks?: Record<string, { env?: string[] }>;
    };
    for (const task of Object.values(turbo.tasks ?? {}))
      for (const name of task.env ?? []) names.add(name);
  }
  return names;
}

test('no workflow bypasses, redirects or narrows the Turbo remote cache', () => {
  for (const file of WORKFLOW_FILES) {
    const text = readFileSync(join(root, '.github/workflows', file), 'utf8');
    // `turbo-ci-run.ts` pins the Vercel remote and its team, and runs every
    // task read-write: a workflow flag or variable would fork the cache.
    expect(text, file).not.toMatch(
      /--force|--no-cache|TURBO_FORCE|TURBO_API|TURBO_TEAM|TURBO_REMOTE_ONLY/
    );
    for (const match of text.matchAll(/TURBO_CACHE=(\S+)/g))
      expect(match[1], file).toBe('local:rw,remote:rw');
  }
});

// A task hashes the env it names, so a variable one workflow sets and another
// does not gives the same work two cache keys. The names below are the ones
// that differ on purpose: the pull request's commit range and the profile
// that sets the verification depth.
test('a workflow sets no hashed env except the pull request range and the profile', () => {
  const hashed = [...hashedEnvNames()];
  const matches = (name: string) =>
    hashed.some((entry) =>
      entry.endsWith('*') ? name.startsWith(entry.slice(0, -1)) : entry === name
    );
  for (const file of WORKFLOW_FILES) {
    const workflow = Bun.YAML.parse(
      readFileSync(join(root, '.github/workflows', file), 'utf8')
    ) as { env?: Record<string, unknown> };
    expect(Object.keys(workflow.env ?? {}).filter(matches), file).toEqual(
      file === 'verify-pr.yml'
        ? ['PR_BASE', 'PR_HEAD', 'VERIFY_PROFILE']
        : file === 'verify-nightly.yml'
          ? ['VERIFY_PROFILE']
          : []
    );
  }
});

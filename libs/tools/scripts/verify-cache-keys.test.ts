import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheDiagnostics } from './verify-cache-diagnostics';

type DryTask = { taskId: string; hash: string; inputs: Record<string, string> };
const config = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../turbo.json'), 'utf8')
) as {
  globalPassThroughEnv: string[];
  tasks: Record<string, { inputs: string[]; outputs: string[]; env: string[] }>;
};
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'verify-cache-keys-'));
  writeFileSync(join(root, '.gitignore'), 'node_modules/\ndist/\n.turbo/\n');
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      packageManager: `bun@${Bun.version}`,
      scripts: {
        build: 'echo build',
        consume: 'echo consume',
        independent: 'echo independent',
      },
    })
  );
  writeFileSync(join(root, 'source.ts'), 'export const value = 1;\n');
  writeFileSync(
    join(root, 'turbo.json'),
    JSON.stringify({
      globalPassThroughEnv: config.globalPassThroughEnv,
      tasks: {
        build: {
          inputs: config.tasks['build']!.inputs.filter(
            (input: string) => !input.startsWith('$TURBO_ROOT$')
          ),
          outputs: config.tasks['build']!.outputs,
          env: config.tasks['build']!.env,
        },
        consume: { dependsOn: ['build'] },
        independent: {},
      },
    })
  );
  const vite = join(root, 'node_modules/.vite/deps');
  mkdirSync(vite, { recursive: true });
  writeFileSync(
    join(vite, '_metadata.json'),
    JSON.stringify({ cacheDir: root, timestamp: root.length })
  );
  return root;
}
function dry(
  root: string,
  tasks: string[],
  overrides: NodeJS.ProcessEnv = {}
): DryTask[] {
  const stdout = execFileSync(
    join(import.meta.dirname, '../../../node_modules/turbo/bin/turbo'),
    [
      'run',
      ...tasks,
      '--framework-inference=false',
      '--cache=local:rw',
      '--dry=json',
    ],
    {
      cwd: root,
      env: { ...process.env, ...overrides },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  return (JSON.parse(stdout) as { tasks: DryTask[] }).tasks;
}

test('explicit spec fingerprints remain hashed even though their cache directory is ignored', () => {
  const root = fixture();
  try {
    writeFileSync(
      join(root, '.gitignore'),
      'node_modules/\n.cache/\n.turbo/\n'
    );
    mkdirSync(join(root, '.cache/spec-inputs'), { recursive: true });
    const parts = [0, 1].map(
      (index) => `.cache/spec-inputs/part-${index}.json`
    );
    for (const part of parts)
      writeFileSync(join(root, part), '{"source":"before"}');
    const inputs = config.tasks['test:spec:0']!.inputs.filter(
      (input) => !input.startsWith('$TURBO_ROOT$')
    );
    writeFileSync(
      join(root, 'turbo.json'),
      JSON.stringify({
        tasks: {
          build: { inputs, outputs: [] },
          independent: {
            inputs: inputs.map((input) => input.replace('part-0', 'part-1')),
            outputs: [],
          },
        },
      })
    );
    const before = dry(root, ['build', 'independent']);
    expect(
      Object.keys(before.find((task) => task.taskId.endsWith('build'))!.inputs)
    ).toContain(parts[0]!);
    writeFileSync(join(root, parts[0]!), '{"source":"after"}');
    const after = dry(root, ['build', 'independent']);
    for (const task of after) {
      const previous = before.find((item) => item.taskId === task.taskId)!;
      expect(task.hash === previous.hash).toBe(
        task.taskId.endsWith('independent')
      );
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('exact task selection preserves dependency hashes across shards, secrets, runs and absolute checkout paths', () => {
  const roots = [fixture(), fixture()];
  try {
    const full = dry(roots[0]!, ['consume', 'independent']);
    const selected = dry(roots[1]!, ['consume'], {
      VERIFY_SHARD: '15',
      VERIFY_CONCURRENCY: '2',
      TURBO_TOKEN: 'fake-test-token',
      GITHUB_RUN_ID: 'different-run',
      GITHUB_WORKSPACE: '/different/absolute/path',
      GITHUB_JOB: 'different-job',
      RAYON_NUM_THREADS: '4',
      VERIFY_LINT_THREADS: '4',
      GOMAXPROCS: '4',
      MODEL_VERIFY_CONCURRENCY: '8',
      VERIFY_TEST_CONCURRENCY: '1',
      VERIFY_SOLVER_SLOTS: '1',
      VERIFY_CACHE_CONCURRENCY: '1',
    });
    expect(selected.length).toBe(2);
    const hashes = new Map(full.map((task) => [task.taskId, task.hash]));
    for (const task of selected)
      expect(task.hash).toBe(hashes.get(task.taskId)!);
  } finally {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  }
});

// regression: verify-vite-generated-build-inputs
test('literal volatile Vite metadata is excluded while real source remains hashed', () => {
  const root = fixture();
  try {
    const first = dry(root, ['build'])[0]!;
    expect(Object.keys(first.inputs)).toContain('source.ts');
    expect(
      Object.keys(first.inputs).some((path) => path.includes('node_modules/'))
    ).toBe(false);
    writeFileSync(join(root, 'source.ts'), 'export const value = 2;\n');
    expect(dry(root, ['build'])[0]!.hash).not.toBe(first.hash);
    expect(config.tasks['build']!.outputs).toContain('dist/**');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('miss diagnostics distinguish absent artifacts, network failures, disabled cache and cold mode', () => {
  const base = {
    hit: false,
    source: null,
    command: '',
    directory: '',
    seconds: 60,
    durationSource: 'fallback' as const,
    dependencies: [],
  };
  const tasks = ['absent', 'network', 'disabled', 'cold'].map((taskId) => ({
    ...base,
    taskId,
    hash: taskId,
    cacheable: taskId !== 'disabled',
  }));
  const reasons = cacheDiagnostics(tasks, { absent: 404, network: 0 }).map(
    (row) => row.reason
  );
  expect(reasons[0]).toContain('compare prior plan');
  expect(reasons[1]).toContain('connectivity');
  expect(reasons[2]).toContain('explicitly disables');
  expect(reasons[3]).toContain('not performed');
});

// regression: ui-quality-window-preprocessing-timeout
test.each([
  'source',
  'test',
  'platform',
  'arch',
  'bun',
  'chrome',
  'FC_SEED',
  'PBT_NUM_RUNS',
  'PBT_RANDOM',
  'unchanged',
])('test verdict key tracks %s', (change) => {
  const root = fixture();
  try {
    const packagePath = join(root, 'package.json');
    const manifest = JSON.parse(readFileSync(packagePath, 'utf8')) as {
      scripts: Record<string, string>;
    };
    manifest.scripts['test'] = 'bun test tests';
    writeFileSync(packagePath, JSON.stringify(manifest));
    writeFileSync(
      join(root, 'turbo.json'),
      JSON.stringify({
        tasks: {
          test: {
            inputs: config.tasks['test']!.inputs,
            env: config.tasks['test']!.env,
            outputs: [],
          },
        },
      })
    );
    mkdirSync(join(root, 'tests'));
    const testPath = join(root, 'tests/window-inference.test.ts');
    writeFileSync(testPath, 'test("window scores", () => {});');
    const keyPath = join(root, 'turbo-platform-key.json');
    const platform = {
      platform: 'darwin',
      arch: 'arm64',
      bun: '1.4.2',
      chrome: '154',
    };
    writeFileSync(keyPath, JSON.stringify(platform));
    const initial = dry(root, ['test'])[0]!;
    expect(Object.keys(initial.inputs)).toContain('source.ts');
    expect(Object.keys(initial.inputs)).toContain(
      'tests/window-inference.test.ts'
    );
    expect(Object.keys(initial.inputs)).toContain('turbo-platform-key.json');
    const env: NodeJS.ProcessEnv = {};
    if (change === 'source')
      writeFileSync(join(root, 'source.ts'), 'export const value = 2;');
    else if (change === 'test')
      writeFileSync(
        testPath,
        'test("window scores", () => { throw Error(); });'
      );
    else if (change in platform)
      writeFileSync(
        keyPath,
        JSON.stringify({ ...platform, [change]: 'changed' })
      );
    else if (change !== 'unchanged')
      env[change] = change === 'PBT_RANDOM' ? '1' : '7';
    const updated = dry(root, ['test'], env)[0]!.hash;
    if (change === 'unchanged') expect(updated).toBe(initial.hash);
    else expect(updated).not.toBe(initial.hash);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// regression: cache-key-example-inherits-nightly-replays
test('a bounded spec verdict never satisfies an exploring run, nor one budget another', () => {
  const root = fixture();
  try {
    const packagePath = join(root, 'package.json');
    const manifest = JSON.parse(readFileSync(packagePath, 'utf8')) as {
      scripts: Record<string, string>;
    };
    manifest.scripts['test:spec:0'] = 'echo spec';
    writeFileSync(packagePath, JSON.stringify(manifest));
    writeFileSync(
      join(root, 'turbo.json'),
      JSON.stringify({
        tasks: {
          'test:spec:0': {
            inputs: ['$TURBO_DEFAULT$'],
            env: config.tasks['test:spec:0']!.env,
            outputs: [],
          },
        },
      })
    );
    const hash = (env: NodeJS.ProcessEnv) =>
      dry(root, ['test:spec:0'], env)[0]!.hash;
    const gate = hash({ QUINT_REPLAY_TRACES: undefined });
    const explore = hash({ QUINT_REPLAY_TRACES: 'all' });
    expect(explore).not.toBe(gate);
    expect(hash({ QUINT_REPLAY_TRACES: '8' })).not.toBe(explore);
    expect(hash({ QUINT_REPLAY_TRACES: '8' })).not.toBe(gate);
    expect(hash({ QUINT_REPLAY_TRACES: 'all' })).toBe(explore);
    // Every numbered spec part declares it.
    const parts = Object.entries(config.tasks).filter(([id]) =>
      /^test:spec:\d+$/.test(id)
    );
    expect(parts.length).toBeGreaterThan(0);
    for (const [id, task] of parts)
      expect(task.env, id).toContain('QUINT_REPLAY_TRACES');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/** Two packages that share nothing; the root may depend on one of them. */
function twoPackages(rootDependsOnB: boolean): string {
  const root = mkdtempSync(join(tmpdir(), 'verify-cache-keys-'));
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n.turbo/\n');
  writeFileSync(join(root, 'bun.lock'), '');
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      packageManager: `bun@${Bun.version}`,
      workspaces: ['pkgs/*'],
      devDependencies: rootDependsOnB ? { '@p/b': 'workspace:*' } : {},
    })
  );
  for (const name of ['a', 'b']) {
    mkdirSync(join(root, 'pkgs', name), { recursive: true });
    writeFileSync(
      join(root, 'pkgs', name, 'package.json'),
      JSON.stringify({ name: `@p/${name}`, scripts: { build: 'echo built' } })
    );
    writeFileSync(join(root, 'pkgs', name, 'source.ts'), 'export {};\n');
  }
  writeFileSync(
    join(root, 'turbo.json'),
    JSON.stringify({
      tasks: { build: { inputs: ['$TURBO_DEFAULT$'], outputs: [] } },
    })
  );
  return root;
}

// regression: root-workspace-dependency-invalidates-every-task
test('a package the root manifest depends on is hashed into every task', () => {
  // Turbo folds the root workspace's internal dependencies into the global
  // hash: with `@p/b` a root dependency, editing it reruns `@p/a` too.
  const hashOfA = (root: string) =>
    dry(root, ['build']).find((task) => task.taskId === '@p/a#build')!.hash;
  for (const rootDependsOnB of [true, false]) {
    const root = twoPackages(rootDependsOnB);
    try {
      const before = hashOfA(root);
      writeFileSync(join(root, 'pkgs/b/source.ts'), 'export const b = 1;\n');
      if (rootDependsOnB) expect(hashOfA(root)).not.toBe(before);
      else expect(hashOfA(root)).toBe(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

// regression: root-workspace-dependency-invalidates-every-task
test('the root manifest depends on no workspace package', () => {
  // The Atlas packages and the glob matcher were root dependencies; every
  // Atlas bump changed all 1,114 task hashes (Verify run 38187450396: 0 hits).
  const root = join(import.meta.dirname, '../../..');
  const manifest = JSON.parse(
    readFileSync(join(root, 'package.json'), 'utf8')
  ) as Record<string, Record<string, string> | undefined> & {
    workspaces: string[];
  };
  const packages = new Set(
    manifest.workspaces.flatMap((pattern) =>
      [...new Bun.Glob(`${pattern}/package.json`).scanSync({ cwd: root })].map(
        (path) =>
          (
            JSON.parse(readFileSync(join(root, path), 'utf8')) as {
              name: string;
            }
          ).name
      )
    )
  );
  expect(packages.size).toBeGreaterThan(100);
  const internal = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ].flatMap((field) =>
    Object.entries(manifest[field] ?? {})
      .filter(
        ([name, version]) =>
          packages.has(name) || version.startsWith('workspace:')
      )
      .map(([name]) => `${field}.${name}`)
  );
  // Declare it in the package that imports it instead.
  expect(internal).toEqual([]);
});

// regression: tools-test-unhashed-model-bindings
test.each([
  'libs/games-harness/tests/quint/matched-game.binding.ts',
  'specs/games/matched-game.qnt',
  'libs/chess-root-harness/package.json',
  'libs/chess-root-harness/turbo.json',
  'libs/profile-harness/src/username.steps.ts',
  '.github/actions/setup/action.yml',
  'apps/product/scripts/ui-quality/sources.json',
])('repository tooling verdict invalidates on %s', (path) => {
  const root = fixture();
  const local = JSON.parse(
    readFileSync(join(import.meta.dirname, '../turbo.json'), 'utf8')
  ) as {
    tasks: { test: { inputs: string[] } };
  };
  const inputs = local.tasks.test.inputs.flatMap((input) =>
    input === '$TURBO_EXTENDS$'
      ? config.tasks['@libs/tools#test']!.inputs
      : [input]
  );
  try {
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'fixture',
        packageManager: `bun@${Bun.version}`,
        workspaces: ['libs/tools'],
      })
    );
    mkdirSync(join(root, 'libs/tools'), { recursive: true });
    writeFileSync(
      join(root, 'libs/tools/package.json'),
      JSON.stringify({
        name: '@libs/tools',
        scripts: { build: 'echo verified' },
      })
    );
    writeFileSync(join(root, 'bun.lock'), '');
    writeFileSync(
      join(root, 'turbo.json'),
      JSON.stringify({
        tasks: {
          build: { inputs, outputs: [] },
        },
      })
    );
    const before = dry(root, ['@libs/tools#build'])[0]!.hash;
    const absolute = join(root, path);
    mkdirSync(join(absolute, '..'), { recursive: true });
    writeFileSync(absolute, path.endsWith('.json') ? '{}' : 'changed binding');
    expect(dry(root, ['@libs/tools#build'])[0]!.hash, path).not.toBe(before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

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
import { cacheDiagnostics } from './check-cache-diagnostics';

type DryTask = { taskId: string; hash: string; inputs: Record<string, string> };
const config = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../../turbo.json'), 'utf8')
) as {
  globalPassThroughEnv: string[];
  tasks: Record<string, { inputs: string[]; outputs: string[]; env: string[] }>;
};
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'check-cache-keys-'));
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

test('exact task selection preserves dependency hashes across shards, secrets, runs and absolute checkout paths', () => {
  const roots = [fixture(), fixture()];
  try {
    const full = dry(roots[0]!, ['consume', 'independent']);
    const selected = dry(roots[1]!, ['consume'], {
      CHECK_SHARD: '15',
      CHECK_CONCURRENCY: '2',
      TURBO_TOKEN: 'fake-test-token',
      GITHUB_RUN_ID: 'different-run',
      GITHUB_WORKSPACE: '/different/absolute/path',
      DEPOT_JOB_ID: 'different-job',
      RAYON_NUM_THREADS: '4',
      CHECK_LINT_THREADS: '4',
      GOMAXPROCS: '4',
      MODEL_CHECK_CONCURRENCY: '8',
    });
    expect(selected.length).toBe(2);
    const hashes = new Map(full.map((task) => [task.taskId, task.hash]));
    for (const task of selected)
      expect(task.hash).toBe(hashes.get(task.taskId)!);
  } finally {
    for (const root of roots) rmSync(root, { recursive: true, force: true });
  }
});

// regression: check-vite-generated-build-inputs
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
test('test verdict keys include source, tests, platform, runtime and property settings', () => {
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
    for (const changed of [
      { platform: 'linux' },
      { arch: 'x64' },
      { bun: '1.4.3' },
      { chrome: '155' },
    ]) {
      writeFileSync(keyPath, JSON.stringify({ ...platform, ...changed }));
      expect(dry(root, ['test'])[0]!.hash).not.toBe(initial.hash);
    }
    writeFileSync(keyPath, JSON.stringify(platform));
    expect(dry(root, ['test'])[0]!.hash).toBe(initial.hash);
    for (const env of [
      { FC_SEED: '7' },
      { PBT_NUM_RUNS: '41' },
      { PBT_RANDOM: '1' },
    ])
      expect(dry(root, ['test'], env)[0]!.hash).not.toBe(initial.hash);
    writeFileSync(testPath, 'test("window scores", () => { throw Error(); });');
    const changedTest = dry(root, ['test'])[0]!.hash;
    expect(changedTest).not.toBe(initial.hash);
    writeFileSync(join(root, 'source.ts'), 'export const value = 2;');
    expect(dry(root, ['test'])[0]!.hash).not.toBe(changedTest);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// regression: tools-test-unhashed-model-bindings
test('repository tooling verdicts invalidate when their discovered inputs change', () => {
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
    for (const path of [
      'libs/chess-harness/tests/quint/multiplayer.binding.ts',
      'specs/chess/multiplayer.qnt',
      'libs/chess-harness/package.json',
      'libs/chess-harness/turbo.json',
      'libs/profile-harness/src/username.steps.ts',
      '.depot/actions/setup/action.yml',
      'apps/product/scripts/ui-quality/sources.json',
    ]) {
      const before = dry(root, ['@libs/tools#build'])[0]!.hash;
      const absolute = join(root, path);
      mkdirSync(join(absolute, '..'), { recursive: true });
      writeFileSync(
        absolute,
        path.endsWith('.json') ? '{}' : 'changed binding'
      );
      expect(dry(root, ['@libs/tools#build'])[0]!.hash, path).not.toBe(before);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

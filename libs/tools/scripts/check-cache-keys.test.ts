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
  tasks: { build: { inputs: string[]; outputs: string[]; env: string[] } };
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
          inputs: config.tasks.build.inputs.filter(
            (input: string) => !input.startsWith('$TURBO_ROOT$')
          ),
          outputs: config.tasks.build.outputs,
          env: config.tasks.build.env,
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
    expect(config.tasks.build.outputs).toContain('dist/**');
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

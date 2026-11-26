import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  admitPrMisses,
  type Change,
  PR_TASK_SECONDS,
  prChanges,
  selectPrTasks,
} from './pr-selection';
import { projectTurboDryRun } from './turbo-dry-run-projection';

type Task = {
  readonly taskId: string;
  readonly directory: string;
  readonly inputs?: readonly string[];
  readonly dependencies?: readonly string[];
  readonly command?: string;
};

const NO_OP = '<NONEXISTENT>';
const SOURCE_A = ['package.json', 'src/a.ts'];
const SOURCE_B = ['package.json', 'src/b.ts'];
const SECRETS = '@libs/tools-harness-ts#verify:secrets';
const ACTIONLINT = '@libs/tools-harness-ts#verify:actionlint';

/** `@x/b` depends on `@x/a`; `@x/c` on neither. */
const GRAPH: readonly Task[] = [
  { taskId: '@x/a#src', directory: 'libs/a', inputs: SOURCE_A, command: NO_OP },
  {
    taskId: '@x/a#tc',
    directory: 'libs/a',
    inputs: [...SOURCE_A, 'tests/a.test.ts'],
  },
  {
    taskId: '@x/a#lint',
    directory: 'libs/a',
    inputs: [
      ...SOURCE_A,
      'tests/a.test.ts',
      '../tools-harness-ts/biome-plugins/no-bare-io.grit',
    ],
  },
  {
    taskId: '@x/a#test',
    directory: 'libs/a',
    inputs: [...SOURCE_A, 'tests/a.test.ts'],
  },
  {
    taskId: '@x/a#test:unit:1',
    directory: 'libs/a',
    inputs: SOURCE_A,
    command: NO_OP,
  },
  {
    taskId: '@x/b#src',
    directory: 'libs/b',
    inputs: SOURCE_B,
    dependencies: ['@x/a#src'],
    command: NO_OP,
  },
  {
    taskId: '@x/b#tc',
    directory: 'libs/b',
    inputs: SOURCE_B,
    dependencies: ['@x/a#src'],
  },
  {
    taskId: '@x/b#test',
    directory: 'libs/b',
    inputs: SOURCE_B,
    dependencies: ['@x/a#src'],
  },
  { taskId: '@x/c#tc', directory: 'pkgs/c', inputs: ['src/c.ts'] },
  { taskId: '@x/c#test', directory: 'pkgs/c', inputs: ['src/c.ts'] },
  { taskId: '@x/slow#test', directory: 'pkgs/slow', inputs: ['src/slow.ts'] },
  {
    taskId: '@x/ui#storybook:build',
    directory: 'pkgs/ui',
    inputs: ['src/ui.tsx'],
  },
  {
    taskId: '@x/ui#test',
    directory: 'pkgs/ui',
    inputs: ['src/ui.tsx'],
    dependencies: ['@x/ui#storybook:build'],
  },
  {
    taskId: '@pkgs/ui-testing-bun-webview-server-ts#test',
    directory: 'pkgs/ui-testing-bun-webview-server-ts',
    inputs: ['src/view.ts'],
  },
  {
    taskId: '@pkgs/quint-server-ts#test',
    directory: 'pkgs/quint-server-ts',
    inputs: ['src/quint.ts'],
  },
  {
    taskId: SECRETS,
    directory: 'libs/tools-harness-ts',
    inputs: ['scripts/verify-secrets.ts'],
  },
  {
    taskId: ACTIONLINT,
    directory: 'libs/tools-harness-ts',
    inputs: ['../../.github/workflows/verify-pr.yml'],
  },
];
const PACKAGES = new Set([
  'libs/a',
  'libs/b',
  'pkgs/c',
  'pkgs/slow',
  'pkgs/ui',
  'pkgs/ui-testing-bun-webview-server-ts',
  'pkgs/quint-server-ts',
  'libs/tools-harness-ts',
]);
const COSTS = { '@x/slow#test': PR_TASK_SECONDS + 1, '@x/c#test': 3 };

function select(changes: readonly Change[]) {
  const source = JSON.stringify({
    tasks: GRAPH.map((task) => ({
      taskId: task.taskId,
      hash: task.taskId,
      command: task.command ?? 'bun run task',
      directory: task.directory,
      dependencies: task.dependencies ?? [],
      inputs: Object.fromEntries(
        (task.inputs ?? []).map((path) => [path, 'h'])
      ),
    })),
    globalCacheInputs: { files: { 'tsconfig.base.json': 'h' } },
  });
  const dryRun = projectTurboDryRun(
    [source],
    changes.map((change) => change.path)
  );
  return selectPrTasks(dryRun, changes, { packages: PACKAGES, costs: COSTS });
}

function verified(...paths: readonly string[]): string[] {
  return select(paths.map((path) => ({ path, deleted: false }))).tasks.map(
    (task) => task.taskId
  );
}

test('a source change verifies its package and every dependent, and nothing else', () => {
  expect(verified('libs/a/src/a.ts')).toEqual([
    '@x/a#tc',
    '@x/a#lint',
    '@x/a#test',
    '@x/b#tc',
    '@x/b#test',
    SECRETS,
  ]);
});

test('a test-only change verifies only its own package', () => {
  expect(verified('libs/a/tests/a.test.ts')).toEqual([
    '@x/a#tc',
    '@x/a#lint',
    '@x/a#test',
    SECRETS,
  ]);
});

test('a shared input outside the package reaches the tasks that declare it', () => {
  expect(
    verified('libs/tools-harness-ts/biome-plugins/no-bare-io.grit')
  ).toEqual(['@x/a#lint', SECRETS]);
  expect(verified('.github/workflows/verify-pr.yml')).toEqual([
    SECRETS,
    ACTIONLINT,
  ]);
});

test('every pull request scans its commits for secrets, even one that changes only documentation', () => {
  expect(verified()).toEqual([SECRETS]);
  expect(verified('README.md', 'docs/CI_STAGE_POLICY.md')).toEqual([SECRETS]);
});

test('a deleted file or changed task definitions reach their package and its dependents', () => {
  expect(
    select([{ path: 'libs/a/src/old.ts', deleted: true }]).tasks.map(
      (task) => task.taskId
    )
  ).toEqual(verified('libs/a/src/a.ts'));
  expect(verified('pkgs/c/turbo.json')).toEqual([
    '@x/c#tc',
    '@x/c#test',
    SECRETS,
  ]);
});

test('root configuration, global inputs and deletions outside every package reach every task', () => {
  const everyTask = [
    '@x/a#tc',
    '@x/a#lint',
    '@x/a#test',
    '@x/b#tc',
    '@x/b#test',
    '@x/c#tc',
    '@x/c#test',
    SECRETS,
    ACTIONLINT,
  ];
  for (const change of [
    { path: 'bun.lock', deleted: false },
    { path: 'package.json', deleted: false },
    { path: 'turbo.json', deleted: false },
    { path: 'bunfig.toml', deleted: false },
    { path: 'tsconfig.base.json', deleted: false },
    { path: 'specs/games/old.feature', deleted: true },
    { path: 'libs/removed/src/index.ts', deleted: true },
  ]) {
    const selection = select([change]);
    expect(selection.everything).toContain(change.path);
    expect(selection.tasks.map((task) => task.taskId)).toEqual(everyTask);
  }
});

test('a task that cannot finish inside the job waits for Release', () => {
  const selection = select([{ path: 'turbo.json', deleted: false }]);
  expect(selection.deferred).toEqual([
    ['@x/slow#test', `measured ${String(PR_TASK_SECONDS + 1)}s`],
    ['@x/ui#test', 'needs @x/ui#storybook:build first'],
    ['@pkgs/ui-testing-bun-webview-server-ts#test', 'drives a browser'],
    ['@pkgs/quint-server-ts#test', 'runs the model-checking solver'],
  ]);
});

test('more changes never verify less', () => {
  const paths = [
    'libs/a/src/a.ts',
    'libs/a/tests/a.test.ts',
    'libs/b/src/b.ts',
    'pkgs/c/src/c.ts',
    'pkgs/c/turbo.json',
    'pkgs/slow/src/slow.ts',
    'pkgs/ui/src/ui.tsx',
    'libs/tools-harness-ts/biome-plugins/no-bare-io.grit',
    '.github/workflows/verify-pr.yml',
    'README.md',
    'bun.lock',
    'specs/games/old.feature',
  ];
  const change = fc.record({
    path: fc.constantFrom(...paths),
    deleted: fc.boolean(),
  });
  assertProperty(
    'pr-selection-monotone',
    fc.property(fc.array(change), fc.array(change), (some, more) => {
      const fewer = new Set(select(some).tasks.map((task) => task.taskId));
      const all = new Set(
        select([...some, ...more]).tasks.map((task) => task.taskId)
      );
      for (const taskId of fewer) expect(all.has(taskId)).toBe(true);
    })
  );
});

test('the diff names every added, modified and deleted path of the commit range', () => {
  const root = mkdtempSync(join(tmpdir(), 'pr-selection-'));
  const git = (...args: readonly string[]) =>
    execFileSync(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args],
      { cwd: root, encoding: 'utf8' }
    ).trim();
  try {
    git('init', '--quiet');
    mkdirSync(join(root, 'libs/a'), { recursive: true });
    writeFileSync(join(root, 'libs/a/kept.ts'), '1');
    writeFileSync(join(root, 'libs/a/gone.ts'), '1');
    git('add', '.');
    git('commit', '--quiet', '-m', 'base');
    const base = git('rev-parse', 'HEAD');
    writeFileSync(join(root, 'libs/a/kept.ts'), '2');
    rmSync(join(root, 'libs/a/gone.ts'));
    writeFileSync(join(root, 'libs/a/new name.ts'), '1');
    git('add', '--all');
    git('commit', '--quiet', '-m', 'head');
    expect(
      [...prChanges(`${base}..${git('rev-parse', 'HEAD')}`, root)].sort(
        (a, b) => a.path.localeCompare(b.path)
      )
    ).toEqual([
      { path: 'libs/a/gone.ts', deleted: true },
      { path: 'libs/a/kept.ts', deleted: false },
      { path: 'libs/a/new name.ts', deleted: false },
    ]);
    expect(() => prChanges(`${base}..missing`, root)).toThrow('git diff');
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});

test('cold PR overflow waits for Release after required and directly changed checks', () => {
  const ids = ['@libs/a#lint', '@libs/b#tc', SECRETS, ACTIONLINT];
  const selected = admitPrMisses(
    ids.map((taskId) => ({ taskId })),
    [{ path: 'libs/b/index.ts', deleted: false }],
    {
      [SECRETS]: 5,
      [ACTIONLINT]: 5,
      '@libs/a#lint': 30,
      '@libs/b#tc': 30,
    },
    1
  );
  expect([...selected].sort()).toEqual(
    [SECRETS, ACTIONLINT, '@libs/b#tc'].sort()
  );
});

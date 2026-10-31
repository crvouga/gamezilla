// @io-wall-ok — disposable workspace exercises Turbo's real task hashes.
import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

const repo = join(import.meta.dirname, '../../..');
const config = JSON.parse(readFileSync(join(repo, 'turbo.json'), 'utf8')) as {
  tasks: Record<string, { inputs: string[]; dependsOn: string[] }>;
};

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'src-test-cache-'));
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n.turbo/\n');
  writeFileSync(join(root, 'bun.lock'), '');
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      packageManager: `bun@${Bun.version}`,
      workspaces: ['pkgs/*'],
    })
  );
  const tasks = Object.fromEntries(
    ['src', 'lint', 'tc', 'test'].map((name) => [
      name,
      {
        inputs: config.tasks[name]!.inputs.filter(
          (input) => !input.startsWith('$TURBO_ROOT$')
        ),
        dependsOn: config.tasks[name]!.dependsOn,
        outputs: [],
      },
    ])
  );
  writeFileSync(join(root, 'turbo.json'), JSON.stringify({ tasks }));
  for (const name of ['a', 'b', 'c']) {
    const dir = join(root, 'pkgs', name);
    mkdirSync(join(dir, 'src'), { recursive: true });
    mkdirSync(join(dir, 'tests'), { recursive: true });
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name: `@p/${name}`,
        scripts: { lint: 'echo lint', tc: 'echo tc', test: 'echo test' },
        ...(name === 'a'
          ? {}
          : {
              dependencies: {
                [`@p/${name === 'b' ? 'a' : 'b'}`]: 'workspace:*',
              },
            }),
      })
    );
    writeFileSync(join(dir, 'src/index.ts'), 'export const value = 1;');
  }
  writeFileSync(
    join(root, 'pkgs/a/tests/tactical-positions.ts'),
    'export const positions = [1];'
  );
  return root;
}

function hashes(root: string): Record<string, string> {
  const output = execFileSync(
    process.execPath,
    [
      join(repo, 'node_modules/turbo/bin/turbo'),
      'run',
      'lint',
      'tc',
      'test',
      '--dry=json',
      '--cache=local:r',
      '--framework-inference=false',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, TURBO_CACHE_DIR: join(root, '.turbo/cache') },
    }
  );
  const plan = JSON.parse(output) as {
    tasks: { taskId: string; hash: string }[];
  };
  return Object.fromEntries(plan.tasks.map((task) => [task.taskId, task.hash]));
}

// regression: test-fixture-invalidates-transitive-consumers
test('test helpers and data invalidate their owner, while production edits invalidate consumers', () => {
  const root = fixture();
  try {
    const before = hashes(root);
    writeFileSync(
      join(root, 'pkgs/a/tests/tactical-positions.ts'),
      'export const positions = [2];'
    );
    writeFileSync(join(root, 'pkgs/a/tests/positions.json'), '[2]');
    const testsChanged = hashes(root);
    for (const task of ['lint', 'tc', 'test']) {
      expect(testsChanged[`@p/a#${task}`]).not.toBe(before[`@p/a#${task}`]);
      for (const consumer of ['b', 'c'])
        expect(
          testsChanged[`@p/${consumer}#${task}`],
          `${consumer} ${task}`
        ).toBe(before[`@p/${consumer}#${task}`]);
    }
    writeFileSync(join(root, 'pkgs/a/src/index.ts'), 'export const value = 2;');
    const productionChanged = hashes(root);
    for (const consumer of ['b', 'c'])
      for (const task of ['lint', 'tc', 'test'])
        expect(productionChanged[`@p/${consumer}#${task}`]).not.toBe(
          testsChanged[`@p/${consumer}#${task}`]
        );
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});

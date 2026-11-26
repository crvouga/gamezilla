// @io-wall-ok — exercise Turbo's hashing and execution in a disposable workspace.
import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

type Summary = { tasks: { taskId: string; hash: string }[] };
const repo = join(import.meta.dir, '../../..');

function fixture(dir: string) {
  const json = (path: string, data: unknown) =>
    writeFileSync(join(dir, path), JSON.stringify(data));
  mkdirSync(join(dir, 'apps/product'), { recursive: true });
  mkdirSync(join(dir, 'apps/admin'));
  json('package.json', {
    name: 'fixture',
    packageManager: `bun@${Bun.version}`,
    workspaces: ['apps/*'],
  });
  writeFileSync(join(dir, 'bun.lock'), '');
  json('turbo.json', {
    tasks: {
      build: { inputs: ['build.ts'], outputs: [] },
      'verify:worker-bundle': {
        dependsOn: ['@apps/product-ts#build'],
        inputs: ['check.ts', 'generated.txt'],
        outputs: [],
      },
    },
  });
  json('apps/product/package.json', {
    name: '@apps/product-ts',
    scripts: { build: 'bun build.ts' },
  });
  json('apps/admin/package.json', {
    name: '@apps/admin-api-ts',
    scripts: { 'verify:worker-bundle': 'bun check.ts' },
  });
  writeFileSync(
    join(dir, 'apps/product/build.ts'),
    'await Bun.write("../admin/generated.txt", "built");'
  );
  writeFileSync(
    join(dir, 'apps/admin/check.ts'),
    'if (await Bun.file("generated.txt").text() !== "built") process.exit(1);'
  );
}

// regression: release-product-build-invalidates-sibling-plan
test('a cold build can generate a file before verification while Turbo records the hashes originally planned', () => {
  const cache = join(repo, '.cache');
  mkdirSync(cache, { recursive: true });
  const dir = mkdtempSync(join(cache, 'verify-build-'));
  try {
    fixture(dir);
    execFileSync('git', ['init', '-q'], { cwd: dir });
    execFileSync('git', ['add', '.'], { cwd: dir });
    const run = (option: string) =>
      execFileSync(
        join(repo, 'node_modules/.bin/turbo'),
        [
          'run',
          '@apps/product-ts#build',
          '@apps/admin-api-ts#verify:worker-bundle',
          '--framework-inference=false',
          '--cache=local:rw',
          '--cache-dir=.turbo/cache',
          option,
        ],
        { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      );
    const hashes = (json: string) =>
      Object.fromEntries(
        (JSON.parse(json) as Summary).tasks.map((task) => [
          task.taskId,
          task.hash,
        ])
      );
    const planned = hashes(run('--dry=json'));
    run('--summarize');
    expect(readFileSync(join(dir, 'apps/admin/generated.txt'), 'utf8')).toBe(
      'built'
    );
    const runs = join(dir, '.turbo/runs');
    const [report] = readdirSync(runs);
    expect(hashes(readFileSync(join(runs, report!), 'utf8'))).toEqual(planned);
    expect(
      hashes(run('--dry=json'))['@apps/admin-api-ts#verify:worker-bundle']
    ).not.toBe(planned['@apps/admin-api-ts#verify:worker-bundle']);
  } finally {
    removeTree(dir);
  }
});

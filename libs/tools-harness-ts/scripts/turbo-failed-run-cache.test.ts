// @io-wall-ok — disposable Turbo workspace and in-process remote cache contract.
import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

const repo = join(import.meta.dirname, '../../..');

function fixture(root: string): void {
  writeFileSync(join(root, '.gitignore'), '.turbo/\nnode_modules/\n');
  writeFileSync(join(root, 'bun.lock'), '');
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      packageManager: `bun@${Bun.version}`,
      workspaces: ['pkgs/*'],
    })
  );
  writeFileSync(
    join(root, 'turbo.json'),
    JSON.stringify({
      tasks: { test: { inputs: ['run.ts'], outputs: ['result.txt'] } },
    })
  );
  for (const name of ['good', 'bad']) {
    const dir = join(root, 'pkgs', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name, scripts: { test: 'bun run.ts' } })
    );
    writeFileSync(
      join(dir, 'run.ts'),
      name === 'bad'
        ? 'process.exit(7);'
        : 'await Bun.write("result.txt", "passed");'
    );
  }
}

async function invoke(root: string, env: NodeJS.ProcessEnv, dry = false) {
  const child = Bun.spawn(
    [
      process.execPath,
      join(repo, 'node_modules/turbo/bin/turbo'),
      'run',
      'test',
      '--continue=dependencies-successful',
      '--framework-inference=false',
      '--cache=local:rw,remote:rw',
      ...(dry ? ['--dry=json'] : []),
    ],
    { cwd: root, env, stdout: 'pipe', stderr: 'pipe' }
  );
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  return { out, err, code };
}

test('a fresh runner restores a successful task from a failed run, without caching the failure', async () => {
  const root = mkdtempSync(join(tmpdir(), 'failed-run-cache-'));
  const artifacts = new Map<string, Uint8Array>();
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === '/v8/artifacts/status')
        return Response.json({ status: 'enabled' });
      if (request.method === 'PUT') {
        artifacts.set(path, new Uint8Array(await request.arrayBuffer()));
        return new Response(null);
      }
      const bytes = artifacts.get(path);
      return new Response(
        request.method === 'HEAD' || !bytes ? null : new Uint8Array(bytes),
        {
          status: bytes ? 200 : 404,
        }
      );
    },
  });
  try {
    fixture(root);
    const env = {
      ...process.env,
      TURBO_API: server.url.origin,
      TURBO_TEAM: 'fixture',
      TURBO_TOKEN: 'fixture-token',
      TURBO_CACHE_DIR: join(root, '.turbo/cache'),
      TURBO_TELEMETRY_DISABLED: '1',
      NO_COLOR: '1',
      FORCE_COLOR: '0',
    };
    const plan = JSON.parse((await invoke(root, env, true)).out) as {
      tasks: { taskId: string; hash: string }[];
    };
    const key = (id: string) =>
      `/v8/artifacts/${plan.tasks.find((task) => task.taskId === id)!.hash}`;
    const first = await invoke(root, env);
    expect(first.code, first.err).toBe(7);
    expect(artifacts.has(key('good#test'))).toBe(true);
    expect(artifacts.has(key('bad#test'))).toBe(false);
    removeTree(join(root, '.turbo/cache'), { whenLocked: 'leave' });
    removeTree(join(root, 'pkgs/good/result.txt'), { whenLocked: 'leave' });
    const second = await invoke(root, env);
    expect(second.code, second.err).toBe(7);
    expect(second.out).toContain('1 cached, 2 total');
    expect(readFileSync(join(root, 'pkgs/good/result.txt'), 'utf8')).toBe(
      'passed'
    );
    expect(artifacts.has(key('bad#test'))).toBe(false);
  } finally {
    server.stop(true);
    removeTree(root, { whenLocked: 'leave' });
  }
}, 30_000);

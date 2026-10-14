import { expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveCacheFlag } from './turbo-ci-run';
import { wallRemoteHas } from './turbo-preflight';

const turbo = join(import.meta.dirname, '../../../node_modules/.bin/turbo');
const sentinel = 'fixture-secret-must-never-enter-a-cache-artifact';
const modelOutputs = (
  JSON.parse(
    readFileSync(join(import.meta.dirname, '../../../turbo.json'), 'utf8')
  ) as { tasks: Record<string, { outputs: string[] }> }
).tasks['check:models']!.outputs;

function fixture(root: string): void {
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      private: true,
      packageManager: `bun@${Bun.version}`,
      workspaces: ['packages/*'],
    })
  );
  writeFileSync(join(root, 'bun.lock'), '');
  writeFileSync(
    join(root, 'turbo.json'),
    JSON.stringify({
      globalPassThroughEnv: ['REPORTS_TOKEN', 'GITHUB_RUN_ID'],
      tasks: {
        build: {
          dependsOn: ['^build'],
          inputs: ['source.txt', 'emit.ts'],
          env: ['BUILD_FLAVOR', 'BUILD_FAIL'],
          outputs: ['dist/**', ...modelOutputs],
        },
      },
    })
  );
  for (const name of ['a', 'b', 'c']) {
    const dir = join(root, 'packages', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({
        name,
        scripts: { build: 'bun emit.ts' },
        ...(name === 'b' ? { dependencies: { a: 'workspace:*' } } : {}),
      })
    );
    writeFileSync(join(dir, 'source.txt'), name);
    writeFileSync(
      join(dir, 'emit.ts'),
      `
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
if (process.env.BUILD_FAIL === 'yes') process.exit(7);
mkdirSync('dist', { recursive: true });
mkdirSync('.cache/harness-report/models/evidence', {recursive: true});
writeFileSync('.cache/harness-report/models/evidence/result.json', 'verified');
mkdirSync('.cache/harness-report/models/quint-home', {recursive: true});
writeFileSync('.cache/harness-report/models/quint-home/runtime.txt', process.env.REPORTS_TOKEN ?? '');
writeFileSync('dist/output.txt', readFileSync('source.txt', 'utf8') + (process.env.BUILD_FLAVOR ?? '')${name === 'b' ? " + readFileSync('../a/dist/output.txt', 'utf8')" : ''});
`
    );
  }
}

async function invoke(
  root: string,
  env: Record<string, string>,
  args: string[],
  expectedStatus = 0
): Promise<string> {
  const child = Bun.spawn(
    [turbo, 'run', 'build', '--framework-inference=false', ...args],
    {
      cwd: root,
      env: {
        ...process.env,
        ...env,
        TURBO_CACHE_DIR: join(root, '.turbo/cache'),
      },
      stdout: 'pipe',
      stderr: 'pipe',
    }
  );
  const [stdout, stderr, status] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  expect(status, stderr + stdout).toBe(expectedStatus);
  return stdout;
}

async function hashes(
  root: string,
  env: Record<string, string>
): Promise<Record<string, string>> {
  const plan = JSON.parse(
    await invoke(root, env, ['--dry=json', '--cache=local:'])
  ) as { tasks: { taskId: string; hash: string }[] };
  return Object.fromEntries(
    plan.tasks.map((task: { taskId: string; hash: string }) => [
      task.taskId,
      task.hash,
    ])
  );
}

// regression: nested-turbo-cache-isolation
// regression: check-cache-write-only-override
// regression: check-model-cache-runtime-artifacts
test('real Turbo restores remote outputs and invalidates only changed inputs and dependents', async () => {
  const root = mkdtempSync(join(tmpdir(), 'turbo-cache-'));
  const artifacts = new Map<string, Uint8Array>();
  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      const key = `${url.pathname}${url.search}`;
      if (url.pathname === '/v8/artifacts/status')
        return Response.json({ status: 'enabled' });
      if (request.method === 'PUT') {
        artifacts.set(key, new Uint8Array(await request.arrayBuffer()));
        return new Response(null, { status: 200 });
      }
      const bytes = artifacts.get(key);
      if (!bytes) return new Response(null, { status: 404 });
      return new Response(
        request.method === 'HEAD' ? null : new Uint8Array(bytes)
      );
    },
  });
  try {
    const product = JSON.parse(
      readFileSync(
        join(import.meta.dirname, '../../../apps/product/turbo.json'),
        'utf8'
      )
    ) as { tasks: Record<string, { outputs: string[] }> };
    const parts = Object.keys(product.tasks).filter((name) =>
      /^test:contract:\d+$/.test(name)
    );
    expect(parts.length).toBeGreaterThan(0);
    for (const name of parts) {
      expect(product.tasks[name]!.outputs).toEqual(modelOutputs);
    }
    fixture(root);
    const env = {
      TURBO_CACHE_DIR: join(root, 'parent-cache'),
      TURBO_API: server.url.origin,
      TURBO_TOKEN: sentinel,
      TURBO_TEAM: 'fixture',
      REPORTS_TOKEN: sentinel,
      GITHUB_RUN_ID: 'first',
      TURBO_TELEMETRY_DISABLED: '1',
      NO_COLOR: '1',
      FORCE_COLOR: '0',
      BUILD_FLAVOR: 'plain',
    };
    const mode = resolveCacheFlag({}, true);
    const args = [`--cache=${mode}`, '--output-logs=full'];
    expect(await invoke(root, env, args)).toContain('0 cached, 3 total');
    expect(artifacts.size).toBe(3);
    // regression: turbo-remote-artifact-url — HEAD must use the query the CLI PUT.
    const stored = await hashes(root, env);
    expect(await wallRemoteHas(env)(stored['a#build']!)).toBe(true);
    for (const key of artifacts.keys()) expect(key).toContain('?slug=fixture');
    const before = await hashes(root, env);
    for (const name of ['a', 'b', 'c']) {
      rmSync(join(root, 'packages', name, 'dist'), { recursive: true });
      rmSync(join(root, 'packages', name, '.cache/harness-report/models'), {
        recursive: true,
      });
    }
    rmSync(join(root, '.turbo/cache'), { recursive: true });
    expect(await invoke(root, env, args)).toContain('3 cached, 3 total');
    expect(
      readFileSync(
        join(
          root,
          'packages/a/.cache/harness-report/models/evidence/result.json'
        ),
        'utf8'
      )
    ).toBe('verified');
    expect(
      existsSync(
        join(root, 'packages/a/.cache/harness-report/models/quint-home')
      )
    ).toBe(false);
    expect(readFileSync(join(root, 'packages/b/dist/output.txt'), 'utf8')).toBe(
      'bplainaplain'
    );
    expect(
      await hashes(root, {
        ...env,
        REPORTS_TOKEN: 'rotated',
        GITHUB_RUN_ID: 'second',
      })
    ).toEqual(before);
    writeFileSync(join(root, 'packages/a/source.txt'), 'changed');
    const after = await hashes(root, env);
    expect(after['a#build']).not.toBe(before['a#build']);
    expect(after['b#build']).not.toBe(before['b#build']);
    expect(after['c#build']).toBe(before['c#build']);
    expect(await invoke(root, env, args)).toContain('1 cached, 3 total');
    expect(readFileSync(join(root, 'packages/b/dist/output.txt'), 'utf8')).toBe(
      'bplainchangedplain'
    );
    expect(await hashes(root, { ...env, BUILD_FLAVOR: 'other' })).not.toEqual(
      after
    );
    expect(await invoke(root, env, ['--cache=local:w,remote:w'])).toContain(
      '0 cached, 3 total'
    );
    const successfulArtifacts = artifacts.size;
    const failedEnv = { ...env, BUILD_FAIL: 'yes' };
    await invoke(root, failedEnv, args, 7);
    expect(artifacts.size).toBe(successfulArtifacts);
    for (const hash of Object.values(await hashes(root, failedEnv)))
      expect(
        [...artifacts.keys()].some((path) =>
          path.includes(`/v8/artifacts/${hash}`)
        )
      ).toBe(false);
    for (const bytes of artifacts.values()) {
      expect(
        Buffer.from(Bun.zstdDecompressSync(bytes)).includes(
          Buffer.from(sentinel)
        )
      ).toBe(false);
    }
  } finally {
    server.stop(true);
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);

import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import { writeUtf8 } from '@pkgs/object-store-root-shared/helpers';

const ROOT = resolve(import.meta.dir, '../../..');
const REGISTRY = Bun.resolveSync(
  '@pkgs/quint-shared/registry',
  import.meta.dir
);
const RUNNER = Bun.resolveSync('@pkgs/quint-server/bun-test', import.meta.dir);

// regression: unbound-model-blocks-independent-specs
// regression: chess-model-preparation-timeout
test('unbound models do not block preparation and still fail their own checks', async () => {
  const root = mkdtempSync(join(tmpdir(), 'prepare-spec-'));
  const store = createNodeFsObjectStore({
    rootDir: root,
    fs: wallNodeFs(),
    layout: 'tree',
  });
  try {
    await writeUtf8(
      store,
      'package.json',
      JSON.stringify({ specDomains: ['runtime'] })
    );
    await writeUtf8(
      store,
      'tests/quint/preference.binding.ts',
      `
      import { bindQuintModel } from ${JSON.stringify(REGISTRY)};
      bindQuintModel({ model: 'preference-recovery', traces: 1, maxSteps: 2,
        actions: {}, observe: async () => ({}) });
      bindQuintModel({ model: 'privacy-recovery', traces: 1, maxSteps: 2,
        actions: {}, observe: async () => ({}) });
    `
    );
    const prepared = spawnSync(
      process.execPath,
      [join(ROOT, 'libs/harness/scripts/prepare-spec.ts')],
      {
        cwd: root,
        env: { ...process.env, PBT_RANDOM: '0' },
        encoding: 'utf8',
      }
    );
    expect({ status: prepared.status, stderr: prepared.stderr }).toEqual({
      status: 0,
      stderr: expect.any(String),
    });
    const draws = join(root, '.cache/quint-draws');
    expect(
      readdirSync(draws).filter((key) =>
        readdirSync(join(draws, key)).includes('ready')
      )
    ).toHaveLength(2);

    await writeUtf8(
      store,
      'unbound.test.ts',
      `
      import { runQuintModel } from ${JSON.stringify(RUNNER)};
      runQuintModel({ packageName: '@example/fixture',
        specPath: ${JSON.stringify(join(ROOT, 'specs/runtime/connection-continuity.qnt'))},
        specUri: 'specs/runtime/connection-continuity.qnt',
        reportDir: ${JSON.stringify(join(root, '.cache/replay'))} });
    `
    );
    const replay = spawnSync(
      process.execPath,
      ['test', join(root, 'unbound.test.ts')],
      {
        cwd: ROOT,
        encoding: 'utf8',
      }
    );
    expect(replay.status).toBe(1);
    expect(replay.stderr).toContain(
      'model connection-continuity has no binding'
    );
    expect(replay.stderr).toContain('draws traces from the model');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);

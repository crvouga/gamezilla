import { expect, test } from 'bun:test';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import { parseArgs } from '@pkgs/observability-cli-shared/args';
import { runCommand } from '@pkgs/observability-cli-shared/commands';
import { discoverLatestLocalTraceSource } from '@pkgs/observability-cli-shared/source-discovery';
import { NdjsonTraceStore } from '@pkgs/observability-root-shared/ndjson';
import { spawnOwned } from '@pkgs/os-server/dev-owner-spawn';
import { instanceDataDir } from './manifest';
import { observeChildFailures } from './process-observability';
import { startObservabilityStack } from './start-observability-stack';

// regression: api-process-crash-only-in-terminal
test('a crashed process remains discoverable by obs after the collector stops', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gz-process-obs-'));
  const dataDir = join(root, 'friday');
  const collector = await startObservabilityStack({
    backend: 'native',
    instanceId: 'friday',
    dataDir: join(dataDir, 'observability'),
  });
  await collector.stop();
  try {
    const child = spawnOwned(
      'bun',
      ['--eval', 'throw new Error("literal room failure ?code=private-code")'],
      {
        stdio: ['ignore', 'ignore', 'pipe'],
      }
    );
    observeChildFailures(
      child,
      { dataDir, instanceId: 'friday' },
      'example-api'
    );
    await once(child, 'close');
    const fs = wallNodeFs();
    const source = await discoverLatestLocalTraceSource(
      createNodeFsObjectStore({ rootDir: root, fs, layout: 'tree' })
    );
    expect(source?.kind).toBe('ndjson');
    if (source?.kind !== 'ndjson') throw new Error('missing archived source');
    const store = new NdjsonTraceStore(
      createNodeFsObjectStore({ rootDir: source.path, fs, layout: 'tree' }),
      source.path
    );
    const result = await runCommand(
      { store, nowMs: Date.now() },
      parseArgs(['last', '--errors'])
    );
    expect(result.code).toBe(0);
    expect(result.text).toContain('process.failure');
    expect(result.text).toContain('literal room failure');
    expect(result.text).toContain('example-api');
    expect(result.text).toContain('process.exit.code=1');
    expect(result.text).not.toContain('private-code');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

// regression: cold-start-erases-crash-evidence
test('a fresh stack clears simulation data while preserving crash evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'gz-obs-restart-'));
  try {
    const dir = instanceDataDir(root, {
      instanceId: 'restart',
      keepData: false,
    });
    const journal = join(dir, 'observability');
    await mkdir(journal, { recursive: true });
    await writeFile(join(journal, 'process-failures.ndjson'), 'literal crash');
    await writeFile(join(dir, 'simulation-state.json'), '{}');
    expect(
      instanceDataDir(root, { instanceId: 'restart', keepData: false })
    ).toBe(dir);
    expect(
      await readFile(join(journal, 'process-failures.ndjson'), 'utf8')
    ).toBe('literal crash');
    expect(await Bun.file(join(dir, 'simulation-state.json')).exists()).toBe(
      false
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

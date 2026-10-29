import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { parseStackOptions } from './stack-options';
import { createStackPlan, planPath, readPlan } from './stack-plan';
import {
  awaitService,
  publishFailed,
  publishOff,
  publishReady,
  withdrawService,
} from './stack-services';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) removeTree(root, { whenLocked: 'leave' });
});

function repoRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'stack-plan-'));
  roots.push(root);
  return root;
}

function plan(args: readonly string[] = []) {
  return createStackPlan(
    repoRoot(),
    parseStackOptions(['--instance', 'alpha', ...args])
  );
}

describe('stack plan', () => {
  test('every process of the stack gets a port of its own', async () => {
    const { ports, apiOrigin, webOrigin } = await plan([
      '--api-nodes',
      '3',
      '--synthetic-population-workers',
      '2',
    ]);
    const all = [
      ports.api,
      ports.google,
      ports.apple,
      ports.billing,
      ports.web,
      ports.postgres,
      ports.openAi,
      ports.s3,
      ports.mqtt,
      ports.mqttWs,
      ...Object.values(ports.observability),
      ...ports.apiNodes,
      ...ports.population,
    ];
    expect(ports.apiNodes).toHaveLength(3);
    expect(ports.population).toHaveLength(2);
    expect(new Set(all).size).toBe(all.length);
    expect(apiOrigin).toBe(`http://127.0.0.1:${String(ports.api)}`);
    expect(webOrigin).toBe(`http://127.0.0.1:${String(ports.web)}`);
  });

  test('a stack without the web app plans no web origin', async () => {
    const planned = await plan(['--no-web']);
    expect(planned.ports.web).toBeNull();
    expect(planned.webOrigin).toBeNull();
  });

  test('each task reads back the plan the boot wrote', async () => {
    const root = repoRoot();
    const written = await createStackPlan(
      root,
      parseStackOptions(['--instance', 'alpha', '--no-mqtt'])
    );
    expect(readPlan(root, 'alpha')).toEqual(written);
    expect(() => readPlan(root, 'beta')).toThrow('dev:prepare');
  });

  test('a new boot starts from an empty instance unless it keeps its data', async () => {
    const root = repoRoot();
    const first = await createStackPlan(
      root,
      parseStackOptions(['--instance', 'alpha'])
    );
    const kept = join(first.dataDir, 'billing.sqlite');
    writeFileSync(kept, '');
    publishReady(first, 'web', { origin: 'http://127.0.0.1:1' });

    const keeping = await createStackPlan(
      root,
      parseStackOptions(['--instance', 'alpha', '--keep-data'])
    );
    expect(existsSync(kept)).toBe(true);
    // What the last boot's services published is stale either way.
    await expect(awaitService(keeping, 'web', 20)).rejects.toThrow(
      'timed out waiting for web'
    );

    await createStackPlan(root, parseStackOptions(['--instance', 'alpha']));
    expect(existsSync(kept)).toBe(false);
    expect(existsSync(planPath(root, 'alpha'))).toBe(true);
  });
});

describe('stack services', () => {
  test('a dependent learns where a service is once it can serve', async () => {
    const planned = await plan();
    const waiting = awaitService(planned, 'postgres');
    publishReady(planned, 'postgres', { databaseUrl: 'postgres://local' });
    expect(await waiting).toEqual({ databaseUrl: 'postgres://local' });
  });

  test('a service the options turn off is known to be absent', async () => {
    const planned = await plan(['--no-mqtt']);
    publishOff(planned, 'mqtt');
    expect(await awaitService(planned, 'mqtt')).toBeNull();
  });

  test('a dependent fails with the reason its service could not start', async () => {
    const planned = await plan();
    publishFailed(planned, 'postgres', 'port in use');
    await expect(awaitService(planned, 'postgres')).rejects.toThrow(
      'postgres failed to start: port in use'
    );
  });

  test('a stopped service is no longer found', async () => {
    const planned = await plan();
    publishReady(planned, 's3', { endpoint: 'http://127.0.0.1:1' });
    withdrawService(planned, 's3');
    await expect(awaitService(planned, 's3', 20)).rejects.toThrow(
      'timed out waiting for s3'
    );
  });
});

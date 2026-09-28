// @io-wall-ok — bun:test preload; product harness env, viewport and log noise
/**
 * bun:test preload for harness e2e suites, after `@pkgs/bun-test-solid/preload`
 * (Solid compile, happy-dom `document` — Solid trees render into it via
 * `MultiAppSolidDomSession` — and the Lingui pin): harness env, a phone
 * viewport, and quieter logs.
 */

import { afterAll, afterEach } from 'bun:test';
import { setDomWindow } from '@pkgs/bun-test-solid/register';
import { wallTimers } from '@pkgs/clock';
import { setDefaultLogLevel } from '@pkgs/logger';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';
import {
  ATTR,
  createNodeTelemetry,
  NdjsonSpanExporter,
  type NodeTelemetry,
} from '@pkgs/observability/node';

process.env['VITE_E2E'] = '1';
process.env['HARNESS_WITH_DOM'] = process.env['HARNESS_WITH_DOM'] ?? '1';

// Phone viewport — `useLayoutMode` picks the compact tab bar.
setDomWindow({ width: 390, height: 844, url: 'http://localhost:8081/' });

setDefaultLogLevel('error');

const telemetry = createArtifactTelemetry();
if (telemetry !== undefined) {
  afterEach(() => flushWithTimeout(telemetry));
  afterAll(() => shutdownWithTimeout(telemetry));
}

const origError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const text = args
    .map((a) =>
      typeof a === 'string' ? a : a instanceof Error ? a.message : ''
    )
    .join(' ');
  if (text.includes('Cannot log after tests are done')) return;
  if (text.includes('Database is closed')) return;
  if (text.includes('createHarness: server disposed')) return;
  origError(...args);
};

function createArtifactTelemetry(): NodeTelemetry | undefined {
  const rootDir = process.env['OBS_TRACE_ARTIFACT_DIR'];
  if (rootDir === undefined || rootDir.trim() === '') return undefined;
  const store = createNodeFsObjectStore({
    rootDir,
    fs: wallNodeFs(),
    layout: 'tree',
  });
  return createNodeTelemetry({
    serviceName: process.env['OBS_TEST_SERVICE'] ?? 'harness-e2e',
    serviceVersion: process.env['GITHUB_SHA'] ?? 'local',
    environment: process.env['GITHUB_ACTIONS'] === 'true' ? 'ci' : 'test',
    buildSha: process.env['GITHUB_SHA'] ?? 'local',
    ...(process.env['OBS_TEST_ID'] === undefined
      ? {}
      : {
          resourceAttributes: {
            [ATTR.APP_TEST_ID]: process.env['OBS_TEST_ID'],
          },
        }),
    exporter: new NdjsonSpanExporter({ store, key: 'spans.ndjson' }),
  });
}

function settleWithin(task: Promise<void>, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = wallTimers.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve();
    }, timeoutMs);
    void task.then(
      () => {
        if (settled) return;
        settled = true;
        wallTimers.clearTimeout(timer);
        resolve();
      },
      () => {
        if (settled) return;
        settled = true;
        wallTimers.clearTimeout(timer);
        resolve();
      }
    );
  });
}

function flushWithTimeout(runtime: NodeTelemetry): Promise<void> {
  return settleWithin(runtime.forceFlush(), 2_000);
}

function shutdownWithTimeout(runtime: NodeTelemetry): Promise<void> {
  return settleWithin(runtime.shutdown(), 2_000);
}

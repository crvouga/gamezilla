// @io-wall-ok — composition for generated bun:test feature entries.

import type { RunReportOptions } from '@crvouga/atlas/reports/report-types';
import { monotonicClock, wallClock } from '@pkgs/clock-shared-ts/wall';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';

export function wallFeatureReport(rootDir: string): RunReportOptions {
  return {
    store: createNodeFsObjectStore({
      rootDir,
      fs: wallNodeFs(),
      layout: 'tree',
    }),
    runId: 'latest',
    now: wallClock.now,
    performance: { clock: monotonicClock, slowStepMs: 50 },
    frames: false,
  };
}

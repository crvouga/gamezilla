// @io-wall-ok — bun:test harness: wall Node-FS report bucket + caller lookup.
/**
 * Report bucket for sim tests. Frames + `report.json` land under the running
 * package's `.cache/sim-report/runs/latest/…`; a package's `test:report`
 * turns that bucket into a standalone `sim-report/index.html`.
 */

import { join, relative, resolve } from 'node:path';

import type { ObjectStore } from '@pkgs/object-store/interface';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';

/** The package whose tests are running (`bun test` runs from its root). */
export const PACKAGE_DIR = process.cwd();
/** This file lives at `libs/sim-harness/src/open-sim/`. */
export const REPO_ROOT = resolve(import.meta.dirname, '../../../..');

/** Raw report bucket (tree layout: keys map 1:1 to files). */
export const SIM_REPORT_DATA_DIR = join(PACKAGE_DIR, '.cache/sim-report');
/** Standalone HTML artifact directory (gitignored). */
export const SIM_REPORT_OUT_DIR = join(PACKAGE_DIR, 'sim-report');
/** JUnit XML the runner writes alongside the bucket (`test:report`). */
export const SIM_REPORT_JUNIT_PATH = join(SIM_REPORT_DATA_DIR, 'junit.xml');

/** One run per `bun test` invocation; the report script wipes it first. */
export const SIM_REPORT_RUN_ID = 'latest';

export function simReportEnabled(): boolean {
  return process.env['SIM_REPORT'] !== '0';
}

let reportStore: ObjectStore | null = null;

export function getReportStore(): ObjectStore {
  reportStore ??= createNodeFsObjectStore({
    rootDir: SIM_REPORT_DATA_DIR,
    fs: wallNodeFs(),
    layout: 'tree',
  });
  return reportStore;
}

export type TestCallSite = {
  readonly sourceFile: string;
  readonly sourceLine: number;
};

const STACK_LOCATION_RE = /\(?((?:\/|[A-Za-z]:\\)[^():]+):(\d+):\d+\)?\s*$/;

/**
 * Repo-relative file + line of the nearest `*.test.*` frame on the stack,
 * so the HTML report can pair this run with the runner's JUnit outcome.
 */
export function testCallSite(stack: string | undefined): TestCallSite | null {
  if (stack === undefined) return null;
  for (const line of stack.split('\n')) {
    const m = STACK_LOCATION_RE.exec(line.trim());
    const file = m?.[1];
    const lineNo = m?.[2];
    if (file === undefined || lineNo === undefined) continue;
    if (!/\.test\.[cm]?[jt]sx?$/.test(file)) continue;
    const rel = relative(REPO_ROOT, file).split('\\').join('/');
    if (rel.startsWith('..')) continue;
    return { sourceFile: rel, sourceLine: Number(lineNo) };
  }
  return null;
}

// @io-wall-ok — bun:test harness: wall Node-FS report bucket + caller lookup.
/**
 * Report bucket for harness tests. Every harness writes its `report.json` (each step,
 * its outcome and error) under the running package's
 * `.cache/harness-report/<part>/runs/latest/…` — `test:spec` caches that bucket, so the
 * report of the last run of this exact code is always there to render.
 * `HARNESS_FRAMES=1` also captures UI frames (slower; a separate cache entry).
 * The `bun check` report (`bun check:report`) folds every package's bucket
 * into its scenario section (`../scenario-report.ts`).
 */

import { join, relative, resolve } from 'node:path';

import type { ObjectStore } from '@pkgs/object-store/interface';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';

/** The package whose tests are running (`bun test` runs from its root). */
const PACKAGE_DIR = process.cwd();
/** This file lives at `libs/harness/src/open-harness/`. */
const REPO_ROOT = resolve(import.meta.dirname, '../../../..');

/**
 * Raw report bucket (tree layout: keys map 1:1 to files). `test-spec.ts` names
 * the bucket of its part (`HARNESS_REPORT_DIR`); a bare `bun test` uses `all`.
 */
const HARNESS_REPORT_DATA_DIR =
  process.env['HARNESS_REPORT_DIR'] ??
  join(PACKAGE_DIR, '.cache/harness-report/all');

/** One run per `bun test` invocation; the report script wipes it first. */
export const HARNESS_REPORT_RUN_ID = 'latest';

/** UI frames on every step — `HARNESS_FRAMES=1` (`bun run test:report --frames`). */
export function harnessFramesEnabled(): boolean {
  return process.env['HARNESS_FRAMES'] === '1';
}

let reportStore: ObjectStore | null = null;

export function getReportStore(): ObjectStore {
  reportStore ??= createNodeFsObjectStore({
    rootDir: HARNESS_REPORT_DATA_DIR,
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

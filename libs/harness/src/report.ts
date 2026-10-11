// @io-wall-ok — bun:test harness: wall Node-FS report bucket + caller lookup.
/**
 * Report bucket for harness tests. Every harness writes its `report.json` (each step,
 * its outcome and error) under the running package's
 * `.cache/harness-report/<part>/runs/latest/…` — `test:spec` caches that bucket, so the
 * report of the last run of this exact code is always there to render.
 * Every step also captures its UI frames. `bun check` publishes every
 * package's bucket to the Atlas explorer.
 */

import { join, relative, resolve } from 'node:path';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';

/** The package whose tests are running (`bun test` runs from its root). */
const PACKAGE_DIR = process.cwd();
/** This file lives at `libs/harness/src/`. */
const REPO_ROOT = resolve(import.meta.dirname, '../../..');

/**
 * Raw report bucket (tree layout: keys map 1:1 to files). `test-spec.ts` names
 * the bucket of its part (`HARNESS_REPORT_DIR`); a bare `bun test` uses `all`.
 */
const HARNESS_REPORT_DATA_DIR =
  process.env['HARNESS_REPORT_DIR'] ??
  join(PACKAGE_DIR, '.cache/harness-report/all');

/** One run per `bun test` invocation; the report script wipes it first. */
export const HARNESS_REPORT_RUN_ID = 'latest';

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

// @io-wall-ok — CLI: bucket → standalone HTML report artifact
/**
 * Build `apps/product/sim-report/index.html` from the sim report bucket
 * (`.cache/sim-report/runs/latest`), overlaying JUnit outcomes when the
 * runner wrote them. Frame previews get the product's compiled CSS.
 *
 * Usage: `bun run --filter @apps/product report:build [--open]`
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';
import { run } from '@pkgs/os';
import { HTML_REPORT_KEY, writeHtmlReport } from '@pkgs/sim';

import {
  REPO_ROOT,
  SIM_REPORT_DATA_DIR,
  SIM_REPORT_JUNIT_PATH,
  SIM_REPORT_OUT_DIR,
  SIM_REPORT_RUN_ID,
} from '../src/test/setup/sim-report';

const TAILWIND_DIR = join(REPO_ROOT, 'pkgs/tailwind');
const TAILWIND_ENTRY = join(TAILWIND_DIR, 'src/tailwind.css');
const UI_CSS = [
  join(REPO_ROOT, 'pkgs/ui/src/theme/tokens.css'),
  join(REPO_ROOT, 'pkgs/ui/src/components/hosts.css'),
];

/** Same stylesheet set the product mounts (`apps/product/src/console/main.tsx`). */
function compileFrameCss(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'sim-report-css-'));
  try {
    const out = join(tmp, 'tailwind.css');
    run(
      'bunx',
      ['--no-install', '@tailwindcss/cli', '-i', TAILWIND_ENTRY, '-o', out],
      { cwd: TAILWIND_DIR }
    );
    return [
      readFileSync(out, 'utf8'),
      ...UI_CSS.map((p) => readFileSync(p, 'utf8')),
    ].join('\n');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export async function buildSimReport(): Promise<{
  readonly indexPath: string;
  readonly testCount: number;
  readonly status: string;
}> {
  const fs = wallNodeFs();
  const store = createNodeFsObjectStore({
    rootDir: SIM_REPORT_DATA_DIR,
    fs,
    layout: 'tree',
  });
  const out = createNodeFsObjectStore({
    rootDir: SIM_REPORT_OUT_DIR,
    fs,
    layout: 'tree',
  });
  const junitXml = existsSync(SIM_REPORT_JUNIT_PATH)
    ? readFileSync(SIM_REPORT_JUNIT_PATH, 'utf8')
    : undefined;
  const bundle = await writeHtmlReport({
    store,
    runId: SIM_REPORT_RUN_ID,
    out,
    title: 'Product sim report',
    frameCss: compileFrameCss(),
    ...(junitXml !== undefined ? { junitXml } : {}),
  });
  return {
    indexPath: resolve(SIM_REPORT_OUT_DIR, HTML_REPORT_KEY),
    testCount: bundle.tests.length,
    status: bundle.status,
  };
}

if (import.meta.main) {
  const result = await buildSimReport();
  process.stdout.write(
    `[sim-report] ${result.status} · ${String(result.testCount)} test(s) → ${result.indexPath}\n`
  );
  if (process.argv.includes('--open')) run('open', [result.indexPath]);
}

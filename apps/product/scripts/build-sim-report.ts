// @io-wall-ok — CLI: bucket → standalone HTML report artifact
/**
 * Build `apps/product/sim-report/index.html` from the sim report bucket
 * (`.cache/sim-report/runs/latest`), overlaying JUnit outcomes when the
 * runner wrote them. Frame previews get the product's compiled CSS.
 *
 * Usage: `bun run --filter @apps/product report:build [--open]`
 */

import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';
import { run } from '@pkgs/os';
import { HTML_REPORT_KEY, writeHtmlReport } from '@pkgs/sim-report';

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

/** Package roots whose `*.module.css` ship unhashed local class names in sims. */
const MODULE_CSS_ROOTS = [
  join(REPO_ROOT, 'pkgs/ui/src'),
  join(REPO_ROOT, 'pkgs/chess-board/src'),
];

function listModuleCss(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.module.css')) out.push(path);
    }
  };
  walk(root);
  return out.sort();
}

/**
 * Stylesheet set for iframe `srcdoc` frames. Matches the product mount
 * (tokens + hosts + Tailwind) plus CSS modules: bun's sim Babel plugin
 * exports unhashed local class names, so the raw module CSS applies.
 */
function compileFrameCss(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'sim-report-css-'));
  try {
    const out = join(tmp, 'tailwind.css');
    run(
      'bunx',
      ['--no-install', '@tailwindcss/cli', '-i', TAILWIND_ENTRY, '-o', out],
      { cwd: TAILWIND_DIR }
    );
    const modules = MODULE_CSS_ROOTS.flatMap(listModuleCss);
    return [
      readFileSync(out, 'utf8'),
      ...UI_CSS.map((p) => readFileSync(p, 'utf8')),
      ...modules.map(
        (p) =>
          `/* ${p.slice(REPO_ROOT.length + 1)} */\n${readFileSync(p, 'utf8')}`
      ),
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

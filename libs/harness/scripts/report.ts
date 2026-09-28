#!/usr/bin/env bun
// @io-wall-ok — CLI: every package's spec run → one standalone HTML report.
/**
 * `bun run test:report [--frames] [--no-run] [--open]` (repo root)
 *
 * The report of the code as it is now. Every `test:spec` run — `bun check`,
 * CI, this script — writes its package's report bucket
 * (`<pkg>/.cache/harness-report`: each Gherkin scenario's and Quint trace's step
 * timeline, the traces themselves, JUnit), and turbo caches the bucket with
 * the verdict. So this runs every `test:spec` through `turbo-ci-run
 * --restore-outputs` with the same flags and env as `bun check`: a suite
 * whose code has not changed since any machine sharing the remote cache ran
 * it restores that run's bucket instead of running again, and only changed
 * suites run. It then folds every bucket (JUnit outcomes overlaid) into one
 * `harness-report/index.html` at the repo root.
 *
 * `--frames` adds UI frames to every step (`HARNESS_FRAMES=1`: slower, and a
 * separate cache entry from `bun check`'s). `--no-run` builds from the
 * buckets already on disk. Exits with the suites' status.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  applyJunitOutcomes,
  type HtmlReportBundle,
  mergeRunBundles,
  parseJunit,
  readRunBundle,
} from '@pkgs/harness';
import { HTML_REPORT_KEY, renderHtmlReport } from '@pkgs/harness-report';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';
import { run } from '@pkgs/os';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const OUT_DIR = join(REPO_ROOT, 'harness-report');
const BUCKET = '.cache/harness-report';
const RUN_ID = 'latest';

const TAILWIND_DIR = join(REPO_ROOT, 'pkgs/tailwind');
const UI_CSS = [
  join(REPO_ROOT, 'pkgs/ui/src/theme/tokens.css'),
  join(REPO_ROOT, 'pkgs/ui/src/components/hosts.css'),
];

type PackageManifest = { readonly scripts?: Record<string, string> };

/** Repo-relative dirs of every package with a spec suite. */
function specPackageDirs(): string[] {
  const dirs: string[] = [];
  for (const tier of ['apps', 'libs', 'pkgs']) {
    for (const name of readdirSync(join(REPO_ROOT, tier))) {
      const manifest = join(REPO_ROOT, tier, name, 'package.json');
      if (!existsSync(manifest)) continue;
      const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as PackageManifest;
      if (pkg.scripts?.['test:spec'] !== undefined)
        dirs.push(`${tier}/${name}`);
    }
  }
  return dirs.sort();
}

function listModuleCss(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') listModuleCss(path, out);
    } else if (entry.name.endsWith('.module.css')) {
      out.push(path);
    }
  }
}

/**
 * Stylesheet set for iframe `srcdoc` frames, matching the product mount
 * (tokens + hosts + Tailwind) plus every `pkgs/` CSS module: bun's harness Babel
 * plugin exports unhashed local class names, so the raw module CSS applies.
 */
function compileFrameCss(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'harness-report-css-'));
  try {
    const out = join(tmp, 'tailwind.css');
    run(
      'bunx',
      [
        '--no-install',
        '@tailwindcss/cli',
        '-i',
        join(TAILWIND_DIR, 'src/tailwind.css'),
        '-o',
        out,
      ],
      { cwd: TAILWIND_DIR }
    );
    const modules: string[] = [];
    for (const name of readdirSync(join(REPO_ROOT, 'pkgs')).sort()) {
      const src = join(REPO_ROOT, 'pkgs', name, 'src');
      if (existsSync(src)) listModuleCss(src, modules);
    }
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

async function readPackageBundle(dir: string): Promise<HtmlReportBundle> {
  const bucket = join(REPO_ROOT, dir, BUCKET);
  const store = createNodeFsObjectStore({
    rootDir: bucket,
    fs: wallNodeFs(),
    layout: 'tree',
  });
  const bundle = await readRunBundle(store, RUN_ID);
  const junit = join(bucket, 'junit.xml');
  return existsSync(junit)
    ? applyJunitOutcomes(bundle, parseJunit(readFileSync(junit, 'utf8')))
    : bundle;
}

const args = new Set(process.argv.slice(2));
let status = 0;
if (!args.has('--no-run')) {
  const suites = spawnSync(
    'bun',
    [
      'run',
      join(REPO_ROOT, 'libs/tools/scripts/turbo-ci-run.ts'),
      '--restore-outputs',
      'test:spec',
    ],
    {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...(args.has('--frames') ? { HARNESS_FRAMES: '1' } : {}),
      },
    }
  );
  status = suites.status ?? 1;
}

const runs: { label: string; bundle: HtmlReportBundle }[] = [];
for (const dir of specPackageDirs()) {
  runs.push({ label: dir, bundle: await readPackageBundle(dir) });
}
const bundle = mergeRunBundles(RUN_ID, runs);
const html = renderHtmlReport(bundle, {
  title: 'spec report — every subsystem',
  frameCss: compileFrameCss(),
});
const out = createNodeFsObjectStore({
  rootDir: OUT_DIR,
  fs: wallNodeFs(),
  layout: 'tree',
});
await out.put(HTML_REPORT_KEY, new TextEncoder().encode(html), 'text/html');

const indexPath = join(OUT_DIR, HTML_REPORT_KEY);
for (const r of runs) {
  process.stdout.write(
    `[harness-report] ${r.label}: ${String(r.bundle.tests.length)} harness(s), ${r.bundle.status}\n`
  );
}
process.stdout.write(
  `[harness-report] ${bundle.status} · ${String(bundle.tests.length)} harness(s) → ${indexPath}\n`
);
if (args.has('--open')) run('open', [indexPath]);
process.exit(status);

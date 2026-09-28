#!/usr/bin/env bun
// @io-wall-ok — CLI: every package's spec run → one standalone HTML report.
/**
 * `bun run libs/harness/scripts/report.ts` — fold every spec part's report
 * bucket on disk into one standalone `harness-report/index.html`.
 *
 * This is the aggregation step of `bun check:report`, and it runs in CI (the
 * Report workflow's publish job), never on a laptop: the shards' buckets
 * (`<pkg>/.cache/harness-report/part-<k>`: step timelines, the traces
 * themselves, JUnit) are downloaded into the checkout and this folds them
 * (JUnit outcomes overlaid) into the one report, each scenario's and Quint
 * trace's step timeline with its snapshots. A package whose suite records no
 * harness timeline yields no report and is named as left out. With an unsplit
 * `test:spec` (bucket `all`) newer than the parts, that run is shown instead.
 * Exits 1 when no bucket was found.
 *
 * `bun check:report` (`libs/tools/scripts/report-remote.ts`) dispatches that
 * workflow and opens the published report.
 */

import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
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
const BUCKET_ROOT = '.cache/harness-report';
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

function junitMtime(bucket: string): number {
  const junit = join(bucket, 'junit.xml');
  return existsSync(junit) ? statSync(junit).mtimeMs : -1;
}

/** The package's latest run: its parts, or the unsplit `all` if newer. */
function latestBuckets(dir: string): string[] {
  const root = join(REPO_ROOT, dir, BUCKET_ROOT);
  if (!existsSync(root)) return [];
  const parts = readdirSync(root)
    .filter((name) => /^part-\d+$/.test(name))
    .map((name) => join(root, name))
    .sort();
  const all = join(root, 'all');
  const partsTime = Math.max(-1, ...parts.map(junitMtime));
  return junitMtime(all) > partsTime ? [all] : parts;
}

async function readBucket(bucket: string): Promise<HtmlReportBundle> {
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

const runs: { label: string; bundle: HtmlReportBundle }[] = [];
for (const dir of specPackageDirs()) {
  for (const bucket of latestBuckets(dir)) {
    runs.push({ label: dir, bundle: await readBucket(bucket) });
  }
}
const bundle = mergeRunBundles(RUN_ID, runs);
const html = renderHtmlReport(bundle, {
  title: 'spec report — every suite',
  frameCss: compileFrameCss(),
  // Every snapshot of every test: pooled and gzipped, not one huge JSON.
  pooled: true,
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
const noReport = specPackageDirs().filter(
  (dir) => !runs.some((r) => r.label === dir && r.bundle.tests.length > 0)
);
if (noReport.length > 0) {
  process.stdout.write(
    `[harness-report] no report to aggregate: ${noReport.join(', ')}\n`
  );
}
process.stdout.write(
  `[harness-report] ${bundle.status} · ${String(bundle.tests.length)} harness(s) → ${indexPath}\n`
);
process.exit(runs.some((r) => r.bundle.tests.length > 0) ? 0 : 1);

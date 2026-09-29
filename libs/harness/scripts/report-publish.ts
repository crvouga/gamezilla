#!/usr/bin/env bun
// @io-wall-ok — CI entry: reads report buckets on disk, writes the shared reports store.
/**
 * Publish this commit's spec reports to the shared reports store (one R2
 * bucket every environment's API reads, keyed by commit sha; layout in
 * `@pkgs/harness-report`). The Check workflow runs it in three steps:
 *
 *   report-publish.ts open              the run starts: the commit's record,
 *                                       its index entry and the stylesheet
 *                                       its snapshots use
 *   report-publish.ts source <bucket>   after the gate: every package's
 *                                       `.cache/harness-report/<bucket>`
 *                                       (`part-<k>`), tests then record
 *   report-publish.ts close             every part is published
 *
 * Each source lands the moment its part is published, so the reports screen
 * (`/reports/<sha>` on any deployment) shows the run filling in. A package
 * whose suite records no harness timeline publishes nothing and is named.
 * The commit is the pull request's head, not the merge commit Actions checks
 * out, so `/reports/<sha>` is the sha `bun check` printed.
 *
 * Needs `REPORTS_BUCKET`, `REPORTS_ENDPOINT`, `REPORTS_WRITE_ACCESS_KEY_ID`
 * and `REPORTS_WRITE_SECRET_ACCESS_KEY` (written by OpenTofu; `secrets-run`
 * loads them).
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
import { wallClock } from '@pkgs/clock';
import { REPORTS_ROOT_PREFIX } from '@pkgs/harness-report';
import {
  closeCommit,
  openCommit,
  publishSource,
} from '@pkgs/harness-report/remote/publish';
import { createGlobalHttpClient } from '@pkgs/http-client/global';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs/wall-node-fs';
import { createS3ObjectStore } from '@pkgs/object-store-s3/impl-s3';
import { run } from '@pkgs/os';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');
const BUCKET_ROOT = '.cache/harness-report';

/** `@pkgs/tailwind`: its `node_modules/.bin` holds the CLI it declares. */
export const TAILWIND_DIR = join(REPO_ROOT, 'pkgs/tailwind');
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

function required(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  if (value === '') {
    console.error(`report-publish: ${name} is not set (run under secrets-run)`);
    process.exit(1);
  }
  return value;
}

function reportsStore(): ObjectStore {
  return createS3ObjectStore({
    bucket: required('REPORTS_BUCKET'),
    endpoint: required('REPORTS_ENDPOINT'),
    accessKeyId: required('REPORTS_WRITE_ACCESS_KEY_ID'),
    secretAccessKey: required('REPORTS_WRITE_SECRET_ACCESS_KEY'),
    region: 'auto',
    rootPrefix: REPORTS_ROOT_PREFIX,
    http: createGlobalHttpClient(),
  });
}

function git(args: readonly string[]): string {
  const result = Bun.spawnSync(['git', ...args], { cwd: REPO_ROOT });
  return result.stdout.toString().trim();
}

function headSha(): string {
  return (
    process.env['PR_HEAD']?.trim() ||
    process.env['GITHUB_SHA']?.trim() ||
    git(['rev-parse', 'HEAD'])
  );
}

function branchName(): string {
  return (
    process.env['GITHUB_HEAD_REF']?.trim() ||
    process.env['GITHUB_REF_NAME']?.trim() ||
    git(['rev-parse', '--abbrev-ref', 'HEAD'])
  );
}

/** The Actions run publishing this report, when there is one. */
function runUrl(): string | null {
  const server = process.env['GITHUB_SERVER_URL']?.trim();
  const repo = process.env['GITHUB_REPOSITORY']?.trim();
  const id = process.env['GITHUB_RUN_ID']?.trim();
  return server && repo && id ? `${server}/${repo}/actions/runs/${id}` : null;
}

async function publishBucket(
  store: ObjectStore,
  bucket: string
): Promise<void> {
  const sha = headSha();
  const empty: string[] = [];
  for (const packageDir of specPackageDirs()) {
    const dir = join(REPO_ROOT, packageDir, BUCKET_ROOT, bucket);
    if (!existsSync(dir)) continue;
    const local = createNodeFsObjectStore({
      rootDir: dir,
      fs: wallNodeFs(),
      layout: 'tree',
    });
    const record = await publishSource(store, {
      sha,
      packageDir,
      bucket,
      local,
    });
    if (record === null) {
      empty.push(packageDir);
      continue;
    }
    console.log(
      `[report-publish] ${record.source}: ${String(record.tests.length)} test(s), ${record.status}`
    );
  }
  if (empty.length > 0) {
    console.log(`[report-publish] no harness timeline: ${empty.join(', ')}`);
  }
}

async function main(argv: readonly string[]): Promise<void> {
  const [command, arg] = argv;
  const store = reportsStore();
  const sha = headSha();
  if (command === 'open') {
    const commit = await openCommit(store, {
      sha,
      branch: branchName(),
      runUrl: runUrl(),
      startedAtMs: wallClock.now(),
      frameCss: compileFrameCss(),
    });
    console.log(`[report-publish] ${sha.slice(0, 9)} open (${commit.branch})`);
    return;
  }
  if (command === 'source' && arg !== undefined && /^[a-z0-9-]+$/.test(arg)) {
    await publishBucket(store, arg);
    return;
  }
  if (command === 'close') {
    const commit = await closeCommit(store, {
      sha,
      endedAtMs: wallClock.now(),
    });
    console.log(`[report-publish] ${sha.slice(0, 9)} ${String(commit.status)}`);
    return;
  }
  console.error('usage: report-publish.ts open | source <bucket> | close');
  process.exit(1);
}

if (import.meta.main) await main(process.argv.slice(2));

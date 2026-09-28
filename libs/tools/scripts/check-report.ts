#!/usr/bin/env bun
// @io-wall-ok — CLI entry (`bun check:report`).
/**
 * The `bun check` report: one standalone HTML file over the whole gate —
 * verdict, every failure with its log, the spec contexts and suites, the
 * scenario report of every spec part that ran, and every task with its turbo
 * hash. `bun check:local` writes it (`turbo-ci-run.ts`); this opens it.
 *
 *   bun check:report                  open the report of the last `bun check:local`
 *   bun check:report <id|sha>         open a stored report by id or commit prefix
 *   bun check:report --list           every stored report
 *   bun check:report --path           print the path instead of opening it
 *   bun check:report --restore        rerun `bun check:local` restoring every cached
 *                                     task's outputs (logs, scenario timelines),
 *                                     then open the full report
 *   bun check:report --restore --frames   … with UI frames (`HARNESS_FRAMES=1`)
 *
 * CI (`.github/workflows/check.yml`) folds the plan's and every shard's
 * fragment into one report:
 *
 *   check-report.ts --merge <fragments dir> --out-dir <dir> [--origin <url>]
 *
 * which writes `<dir>/check-report-<id>.html` and prints `id=`, `verdict=`
 * and `path=` lines for `$GITHUB_OUTPUT`.
 *
 * A report's id is the gate fingerprint (a hash over every task's turbo
 * hash): the same inputs name the same report on every machine. Reports live
 * in `.cache/check-report/<id>/`.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { run } from '@pkgs/os';
import { mergeFragments } from './check-report/model';
import {
  latestId,
  readFragments,
  renderReportHtml,
  reportHtmlPath,
  resolveReport,
  storedReports,
} from './check-report/store';

const REPO_ROOT = resolve(import.meta.dirname, '../../..');

function flagValue(args: readonly string[], flag: string): string | null {
  const at = args.indexOf(flag);
  const value = at < 0 ? undefined : args[at + 1];
  return value === undefined || value.startsWith('--') ? null : value;
}

function openInBrowser(path: string): void {
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
  try {
    run(opener, [path]);
  } catch {
    console.log(`check-report: open ${path} in a browser`);
  }
}

function merge(args: readonly string[]): number {
  const dir = flagValue(args, '--merge');
  const outDir = flagValue(args, '--out-dir');
  if (dir === null || outDir === null) {
    console.error('usage: check-report.ts --merge <dir> --out-dir <dir>');
    return 1;
  }
  const report = mergeFragments(
    readFragments(dir),
    flagValue(args, '--origin')
  );
  mkdirSync(outDir, { recursive: true });
  const path = join(outDir, `check-report-${report.id}.html`);
  writeFileSync(
    path,
    renderReportHtml({ repoRoot: REPO_ROOT, report, frames: false })
  );
  console.log(`id=${report.id}\nverdict=${report.verdict}\npath=${path}`);
  return 0;
}

function list(): number {
  const latest = latestId(REPO_ROOT);
  for (const report of storedReports(REPO_ROOT)) {
    const mark = report.id === latest ? '*' : ' ';
    const commit = report.scm?.sha.slice(0, 9) ?? '—';
    console.log(
      `${mark} ${report.id}  ${report.verdict.padEnd(10)}  ${commit}  ${report.scm?.branch ?? ''}`
    );
  }
  return 0;
}

/** Rerun the gate leaving every task's outputs on disk; its status. */
function restore(frames: boolean): number {
  const result = spawnSync('bun', ['run', 'check:local', '--restore-outputs'], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...(frames ? { HARNESS_FRAMES: '1' } : {}) },
  });
  return result.status ?? 1;
}

function show(args: readonly string[]): number {
  const query = args.find((arg) => !arg.startsWith('--')) ?? 'latest';
  const report = resolveReport(REPO_ROOT, query);
  if (report === null) {
    console.error(
      query === 'latest'
        ? 'check-report: no report yet — run `bun check:local` first'
        : `check-report: no stored report matches ${query} (bun check:report --list)`
    );
    return 1;
  }
  const path = reportHtmlPath(REPO_ROOT, report.id);
  console.log(
    `check-report: ${report.verdict} · ${report.id} → ${relative(REPO_ROOT, path)}`
  );
  if (!args.includes('--path')) openInBrowser(path);
  return 0;
}

function main(args: readonly string[]): number {
  if (args.includes('--merge')) return merge(args);
  if (args.includes('--list')) return list();
  if (args.includes('--restore')) {
    const status = restore(args.includes('--frames'));
    const shown = show(args.filter((arg) => arg !== '--restore'));
    return status === 0 ? shown : status;
  }
  return show(args);
}

process.exit(main(process.argv.slice(2)));

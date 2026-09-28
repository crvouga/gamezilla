#!/usr/bin/env bun
// @io-wall-ok — gh CLI entry
/**
 * `bun check:report [--no-frames] [--no-run] [--rerun] [--open]`: the spec
 * report of the current commit, built on GitHub and served from the reports
 * bucket, so this machine only dispatches a workflow, waits, and opens a URL.
 *
 * The report of a commit lives at a fixed URL (`report-key.ts`). If it is
 * already there, that is opened and nothing runs; otherwise the Report
 * workflow (`.github/workflows/report.yml`) runs every spec part with UI
 * snapshots, aggregates them into one `index.html` and publishes it.
 *
 *   --no-frames  step timelines only, without snapshots (faster)
 *   --no-run     never dispatch: open the commit's report if it exists,
 *                fail if it does not
 *   --rerun      run again even though the commit already has a report
 *   --open       open the report in the browser
 *
 * Like `bun check`, it first runs `/git-sync` so the run reports exactly the
 * local HEAD, and Ctrl-C cancels the run on GitHub. Refuses on `main`.
 */

import { spawnSync } from 'node:child_process';

import { CheckRemoteError, runWorkflow, syncBranch } from './check-remote';
import { SyncError } from './git-sync';
import { readReportHosting, reportUrl } from './report-key';

const WORKFLOW = 'report.yml';
const LABEL = 'report';
const OWN_FLAGS = new Set(['--no-frames', '--no-run', '--rerun', '--open']);

/** Whether the report is already published (cache-busted: no stale 404). */
async function exists(url: string): Promise<boolean> {
  const response = await fetch(`${url}?t=${String(Date.now())}`, {
    method: 'HEAD',
  });
  return response.ok;
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((arg) => OWN_FLAGS.has(arg)));
  const frames = !flags.has('--no-frames');
  const hosting = readReportHosting();

  const { branch, sha } = syncBranch(argv.filter((arg) => !OWN_FLAGS.has(arg)));
  const url = reportUrl(hosting.hostname, sha, frames);

  let code = 0;
  if (flags.has('--rerun') || !(await exists(url))) {
    if (flags.has('--no-run')) {
      throw new CheckRemoteError(
        `no report for ${sha.slice(0, 9)} yet (${url}); drop --no-run to build it.`
      );
    }
    ({ code } = await runWorkflow({
      workflow: WORKFLOW,
      label: LABEL,
      branch,
      sha,
      inputs: { frames: String(frames) },
    }));
    // A red suite still publishes its report; a missing one is the real failure.
    if (!(await exists(url))) return code === 0 ? 1 : code;
  } else {
    console.log(`${LABEL}: already built for ${sha.slice(0, 9)}`);
  }

  console.log(`${LABEL}: ${url}`);
  if (flags.has('--open')) spawnSync('open', [url]);
  return code;
}

if (import.meta.main) {
  try {
    process.exit(await main());
  } catch (error) {
    if (!(error instanceof CheckRemoteError || error instanceof SyncError)) {
      throw error;
    }
    console.error(`${LABEL}: ${error.message}`);
    process.exit(1);
  }
}

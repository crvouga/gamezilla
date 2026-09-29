#!/usr/bin/env bun
// @io-wall-ok — gh CLI entry
/**
 * `bun check:report [--no-frames] [--no-run] [--rerun] [--open]`: the spec
 * report of the current commit, built on GitHub into the shared reports
 * store and read through the dev deployment's reports screen, so this
 * machine only dispatches a workflow, waits, and opens a URL.
 *
 * The report of a commit is at `https://<dev apex>/reports/<sha>` (and at
 * `/reports/<sha>` on every other deployment: they all read one store). If
 * the dev API already has it, that is opened and nothing runs; otherwise the
 * Report workflow (`.github/workflows/report.yml`) runs every spec part with
 * UI snapshots and publishes each part as it finishes. The page opens as
 * soon as the run has opened the commit and fills in live.
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
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CheckRemoteError, runWorkflow, syncBranch } from './check-remote';
import { SyncError } from './git-sync';

const WORKFLOW = 'report.yml';
const LABEL = 'report';
const OWN_FLAGS = new Set(['--no-frames', '--no-run', '--rerun', '--open']);
/** The deployment whose reports screen this command opens. */
const DEV_ENV_FILE = resolve(
  import.meta.dir,
  '../../infra/tofu/envs/dev.tfvars.json'
);
const POLL_MS = 5_000;

type Hosts = { readonly apex: string; readonly api: string };

function devHosts(): Hosts {
  const env = JSON.parse(readFileSync(DEV_ENV_FILE, 'utf8')) as {
    readonly hosts: Hosts;
  };
  return env.hosts;
}

/** Whether the dev API holds a report for `sha` (running or complete). */
async function exists(hosts: Hosts, sha: string): Promise<boolean> {
  const response = await fetch(`https://${hosts.api}/api/reports/${sha}`);
  return response.ok;
}

function sleep(ms: number): Promise<void> {
  return new Promise((done) => setTimeout(done, ms));
}

/** Open `url` once the run has opened the commit; stop when `until` settles. */
async function openWhenPublished(
  hosts: Hosts,
  sha: string,
  url: string,
  until: Promise<unknown>
): Promise<void> {
  let settled = false;
  void until.finally(() => {
    settled = true;
  });
  while (!settled) {
    if (await exists(hosts, sha)) {
      console.log(`${LABEL}: ${url}`);
      spawnSync('open', [url]);
      return;
    }
    await sleep(POLL_MS);
  }
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const flags = new Set(argv.filter((arg) => OWN_FLAGS.has(arg)));
  const frames = !flags.has('--no-frames');
  const hosts = devHosts();

  const { branch, sha } = syncBranch(argv.filter((arg) => !OWN_FLAGS.has(arg)));
  const url = `https://${hosts.apex}/reports/${sha}`;

  if (!flags.has('--rerun') && (await exists(hosts, sha))) {
    console.log(`${LABEL}: already published for ${sha.slice(0, 9)}`);
    console.log(`${LABEL}: ${url}`);
    if (flags.has('--open')) spawnSync('open', [url]);
    return 0;
  }
  if (flags.has('--no-run')) {
    throw new CheckRemoteError(
      `no report for ${sha.slice(0, 9)} yet (${url}); drop --no-run to build it.`
    );
  }
  const run = runWorkflow({
    workflow: WORKFLOW,
    label: LABEL,
    branch,
    sha,
    inputs: { frames: String(frames) },
  });
  if (flags.has('--open')) await openWhenPublished(hosts, sha, url, run);
  const { code } = await run;
  // A red suite still publishes its report; a missing one is the real failure.
  if (!(await exists(hosts, sha))) return code === 0 ? 1 : code;
  console.log(`${LABEL}: ${url}`);
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

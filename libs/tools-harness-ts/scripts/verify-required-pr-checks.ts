#!/usr/bin/env bun
// @io-wall-ok — read all PR checks from GitHub; the policy itself is pure.
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  isPullRequestCheck,
  type PrCheck,
  type RequiredPrCheck,
  requiredPrCheckFailures,
} from './required-pr-checks';
import { completedPrChecks } from './required-pr-checks-completion';

type CheckRun = {
  readonly name: string;
  readonly status: string;
  readonly conclusion: string | null;
  readonly app: { readonly id: number };
  readonly details_url: string;
};
type CommitStatus = { readonly context: string; readonly state: string };

function pages<T>(endpoint: string): readonly T[] {
  const result = spawnSync('gh', ['api', '--paginate', '--slurp', endpoint], {
    encoding: 'utf8',
  });
  if (result.status !== 0)
    throw new Error(`Cannot inspect mandatory PR checks: ${result.stderr}`);
  return JSON.parse(result.stdout) as readonly T[];
}

function pullRequestChecks(
  repository: string,
  checks: readonly CheckRun[]
): readonly CheckRun[] {
  const events = new Map<string, string>();
  return checks.filter((check) => {
    if (check.app.id !== 15368) return true;
    const id = check.details_url.match(/\/actions\/runs\/(\d+)(?:\/|$)/)?.[1];
    if (id === undefined)
      throw new Error(`Cannot identify the workflow for ${check.name}`);
    let event = events.get(id);
    if (event === undefined) {
      const result = spawnSync(
        'gh',
        ['api', `repos/${repository}/actions/runs/${id}`, '--jq', '.event'],
        { encoding: 'utf8' }
      );
      if (result.status !== 0)
        throw new Error(`Cannot identify PR check source: ${result.stderr}`);
      event = result.stdout.trim();
      events.set(id, event);
    }
    return isPullRequestCheck(check.app.id, event);
  });
}

function checksFor(repository: string, sha: string): readonly PrCheck[] {
  const base = `repos/${repository}/commits/${sha}`;
  const runs = pages<{ readonly check_runs: readonly CheckRun[] }>(
    `${base}/check-runs?filter=latest&per_page=100`
  ).flatMap((page) => page.check_runs);
  const checks = pullRequestChecks(repository, runs).map((check) => ({
    name: check.name,
    appId: check.app.id,
    status: check.status,
    conclusion: check.conclusion,
  }));
  // The status API is newest first; an older status must not override its replacement.
  const statuses = new Map<string, PrCheck>();
  for (const page of pages<readonly CommitStatus[]>(
    `${base}/statuses?per_page=100`
  ))
    for (const status of page)
      if (!statuses.has(status.context))
        statuses.set(status.context, {
          name: status.context,
          appId: 0,
          status: status.state === 'pending' ? 'in_progress' : 'completed',
          conclusion: status.state === 'success' ? 'success' : status.state,
        });
  return [...checks, ...statuses.values()];
}

async function main(): Promise<void> {
  const repository = process.env['GITHUB_REPOSITORY'];
  const head = process.env['PR_HEAD'];
  const merge = process.env['GITHUB_SHA'];
  if (!repository || !head || !merge)
    throw new Error(
      'Mandatory PR checks require GITHUB_REPOSITORY, PR_HEAD and GITHUB_SHA'
    );
  const directory = join(
    import.meta.dirname,
    '../../infra-shared-ts/tofu/modules/repository/required-checks'
  );
  const required = readdirSync(directory)
    .filter((file) => file.endsWith('.json'))
    .map(
      (file) =>
        JSON.parse(
          readFileSync(join(directory, file), 'utf8')
        ) as RequiredPrCheck
    );
  const checks = await completedPrChecks(
    required,
    () =>
      [...new Set([head, merge])].flatMap((sha) => checksFor(repository, sha)),
    // The existing workflow job deadline bounds this dependency wait.
    () => Bun.sleep(10_000)
  );
  const failures = requiredPrCheckFailures(
    required,
    checks,
    process.env['SHARD_RESULT'] === 'skipped'
  );
  if (failures.length > 0) throw new Error(failures.join('\n'));
  console.log(
    `Every discovered PR check passed and is mandatory (${checks.length} check results)`
  );
}

if (import.meta.main) await main();

// @io-wall-ok — CI planning adapter: reads the repository's self-hosted runners.
/**
 * How many runners can take this run's shards. A Verify run's shards request
 * the OS and arch `verify:start` ran on, so only online self-hosted runners
 * carrying both labels count; busy ones count too, because they free up
 * while the run waits. The plan never makes more shards than these runners:
 * an extra shard only queues and pays its checkout and install again.
 *
 * Listing runners needs repository Administration read, which the workflow
 * token lacks, so this reads with `GITHUB_ADMIN_TOKEN` from the secrets
 * store. Without it, or when the listing fails, the plan keeps its
 * configured cap.
 */
import { spawnSync } from 'node:child_process';

export type ListedRunner = {
  readonly status: string;
  readonly labels: readonly { readonly name: string }[];
};

export function matchingRunners(
  runners: readonly ListedRunner[],
  os: string,
  arch: string
): number {
  const wanted = ['self-hosted', os, arch].map((label) => label.toLowerCase());
  return runners.filter(
    (runner) =>
      runner.status === 'online' &&
      wanted.every((label) =>
        runner.labels.some((own) => own.name.toLowerCase() === label)
      )
  ).length;
}

/** Online runners for this job's OS and arch, or `undefined` when unknown. */
export function availableRunners(
  env: Readonly<Record<string, string | undefined>>
): number | undefined {
  const override = env['VERIFY_RUNNERS']?.trim();
  if (override) {
    const runners = Number(override);
    if (!Number.isSafeInteger(runners) || runners < 1)
      throw new Error('VERIFY_RUNNERS must be a positive integer');
    return runners;
  }
  const repository = env['GITHUB_REPOSITORY'];
  const os = env['RUNNER_OS'];
  const arch = env['RUNNER_ARCH'];
  const token = env['GITHUB_ADMIN_TOKEN']?.trim();
  if (!repository || !os || !arch) return undefined;
  if (!token) {
    console.warn(
      '::warning::GITHUB_ADMIN_TOKEN is not set; shard count keeps its configured cap'
    );
    return undefined;
  }
  const listed = spawnSync(
    'gh',
    [
      'api',
      '--paginate',
      '--slurp',
      `repos/${repository}/actions/runners?per_page=100`,
    ],
    { encoding: 'utf8', env: { ...process.env, GH_TOKEN: token } }
  );
  if (listed.status !== 0) {
    console.warn(
      `::warning::Could not list runners (${listed.stderr.trim().split('\n')[0] ?? 'gh failed'}); shard count keeps its configured cap`
    );
    return undefined;
  }
  const pages = JSON.parse(listed.stdout) as {
    runners: ListedRunner[];
  }[];
  const runners = matchingRunners(
    pages.flatMap((page) => page.runners),
    os,
    arch
  );
  console.log(`runners: ${String(runners)} online for ${os} ${arch}`);
  // This job runs on one of them, so the API's view cannot be zero.
  return Math.max(1, runners);
}

import { distribution } from './check-benchmark-stats';

export type NativeJob = {
  job_key: string;
  started_at?: string;
  finished_at?: string;
};
export type NativeTiming = {
  run: { created_at: string };
  workflows: { jobs: { job: NativeJob }[] }[];
};
const time = (value: string | undefined) => (value ? Date.parse(value) : 0);
const elapsed = (job: NativeJob) =>
  (time(job.finished_at) - time(job.started_at)) / 1000;

export function measureCheck(metrics: NativeTiming, cores: number) {
  const jobs = metrics.workflows.flatMap((workflow) =>
    workflow.jobs.map((item) => item.job)
  );
  const gate = jobs.find((job) => /:check$/.test(job.job_key))!;
  const planner = jobs.find((job) => /:check-plan$/.test(job.job_key));
  const shards = jobs.filter((job) =>
    /:check-shards:matrix-/.test(job.job_key)
  );
  const report = jobs.find((job) => /:check-reports$/.test(job.job_key));
  const finished = shards.map((job) => time(job.finished_at));
  return {
    gateSeconds: (time(gate.finished_at) - time(metrics.run.created_at)) / 1000,
    planningJobSeconds: planner ? elapsed(planner) : 0,
    plannerQueueSeconds: planner
      ? (time(planner.started_at) - time(metrics.run.created_at)) / 1000
      : 0,
    shardSchedulingSeconds: distribution(
      shards.map(
        (job) =>
          (time(job.started_at) -
            time(planner?.finished_at ?? metrics.run.created_at)) /
          1000
      )
    ),
    gateSchedulingSeconds:
      (time(gate.started_at) - Math.max(...finished)) / 1000,
    requiredCoreSeconds:
      shards.reduce((sum, job) => sum + elapsed(job) * cores, 0) +
      (planner ? elapsed(planner) * 16 : 0) +
      elapsed(gate) * 2,
    reportSeconds: report?.finished_at ? elapsed(report) : null,
  };
}

export function measureShardLog(log: string) {
  const lines = log.split('\n');
  const stamp = (fragment: string) => {
    const line = lines.find((item) => item.includes(fragment));
    return line ? Date.parse(line.split(' ')[0]!) : 0;
  };
  const between = (start: string, end: string) =>
    (stamp(end) - stamp(start)) / 1000;
  const summary =
    /shard (\d+): (\d+) tasks; estimated ([\d.]+) task-seconds; actual ([\d.]+)s; (\d+) hits; \d+ planned misses; prefetch (\d+)ms/.exec(
      log
    );
  if (!summary) throw new Error('Missing shard timing verdict');
  return {
    index: Number(summary[1]),
    tasks: Number(summary[2]),
    estimatedTaskSeconds: Number(summary[3]),
    actualSeconds: Number(summary[4]),
    hits: Number(summary[5]),
    prefetchSeconds: Number(summary[6]) / 1000,
    checkoutSeconds: between(
      'Syncing repository:',
      '##[group]Run set -euo pipefail'
    ),
    patchTransferSeconds: between(
      '##[group]Run set -euo pipefail',
      '##[group]Run echo "MISE_TRUSTED_CONFIG_PATHS'
    ),
    miseSeconds: between(
      '##[group]Restoring mise cache',
      '##[group]Run bun install --frozen-lockfile'
    ),
    installSeconds: Number(
      /packages installed \[([\d.]+)s\]/.exec(log)?.[1] ?? 0
    ),
    artifactTransferSeconds: between(
      'Beginning upload of artifact content',
      'has been successfully uploaded!'
    ),
  };
}

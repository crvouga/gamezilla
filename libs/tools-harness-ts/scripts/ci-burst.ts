// Replay measured start → parallel shards → end service times with a FIFO pool.
// Each cohort arrives together. External work, provisioning and cache state are
// fixed at their observed values, so these are capacity scenarios.
import {
  distribution,
  type JobRecord,
  jobFamily,
  type RunRecord,
  secondsBetween,
} from './ci-stats-history';

type Trace = {
  readonly setup: number;
  readonly shards: readonly number[];
  readonly verdict: number;
};

function trace(jobs: readonly JobRecord[]): Trace | undefined {
  const start = jobs.find((job) => job.name === 'verify:start');
  const end = jobs.find((job) => job.name === 'verify:end');
  if (end?.conclusion !== 'success') return undefined;
  const seconds = (job: JobRecord) =>
    secondsBetween(job.startedAt, job.completedAt);
  const verdict = seconds(end);
  const setup = start?.conclusion === 'success' ? seconds(start) : 0;
  const shards = jobs
    .filter(
      (job) =>
        jobFamily(job.name) === 'verify:shards' && job.conclusion === 'success'
    )
    .map(seconds);
  if (
    verdict === undefined ||
    setup === undefined ||
    shards.includes(undefined)
  )
    return undefined;
  return { setup, verdict, shards: shards.filter((n) => n !== undefined) };
}

export function prTraces(
  runs: readonly RunRecord[],
  jobs: readonly JobRecord[]
) {
  const byRun = Map.groupBy(jobs, (job) => job.runId);
  const traces = new Map<string, Trace>();
  for (const run of [...runs].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  )) {
    if (
      run.workflow !== 'Verify PR' ||
      run.event !== 'pull_request' ||
      run.conclusion !== 'success' ||
      traces.has(run.headBranch)
    )
      continue;
    const sample = trace(byRun.get(run.id) ?? []);
    if (sample) traces.set(run.headBranch, sample);
  }
  return [...traces.values()];
}

export function burst(samples: readonly Trace[], slots: number) {
  if (!Number.isSafeInteger(slots) || slots < 1 || !samples.length)
    throw new Error(
      'A burst needs positive runner capacity and at least one PR trace'
    );
  const free = Array<number>(
    Math.min(
      slots,
      samples.reduce((n, s) => n + 2 + s.shards.length, 0)
    )
  ).fill(0);
  const ready: { at: number; seconds: number; done: (end: number) => void }[] =
    [];
  const finishes: number[] = [];
  const waits: number[] = [];
  let busy = 0;
  for (const sample of samples) {
    const end = (at: number) =>
      ready.push({
        at,
        seconds: sample.verdict,
        done: (t) => finishes.push(t),
      });
    const start = (at: number) => {
      let remaining = sample.shards.length;
      if (!remaining) end(at);
      let latest = at;
      for (const seconds of sample.shards)
        ready.push({
          at,
          seconds,
          done: (t) => {
            latest = Math.max(latest, t);
            if (--remaining === 0) end(latest);
          },
        });
    };
    if (sample.setup) ready.push({ at: 0, seconds: sample.setup, done: start });
    else start(0);
  }
  while (ready.length) {
    ready.sort((a, b) => a.at - b.at);
    const next = ready.shift()!;
    const slot = free.indexOf(Math.min(...free));
    const start = Math.max(next.at, free[slot]!);
    free[slot] = start + next.seconds;
    waits.push(start - next.at);
    busy += next.seconds;
    next.done(free[slot]!);
  }
  const elapsed = Math.max(...finishes);
  return {
    prs: finishes.length,
    runnerSlots: slots,
    jobQueueP95Seconds: distribution(waits).p95,
    verdictP95Seconds: distribution(finishes).p95,
    runnerSeconds: busy,
    prsPerMinute: elapsed > 0 ? (finishes.length * 60) / elapsed : null,
  };
}

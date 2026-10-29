/**
 * The CI capacity brief as one markdown document. Pure: `ci-stats.ts` gathers
 * the numbers and writes what this returns, for a person or an LLM to size
 * hardware from.
 */
import {
  LEAF_VERIFY_SECONDS,
  NARROW_VERIFY_SECONDS,
  PR_VERIFY_SECONDS,
  SPEC_WORKER_CAP,
  SPEC_WORKER_GIB,
  WARM_START_SECONDS,
} from './ci-runner-capacity';
import type { HistoryStats } from './ci-stats-build';
import type { ConcurrencyStats } from './ci-stats-concurrency';
import type { Distribution, WorkflowStats } from './ci-stats-history';
import type { TaskRow, Workload } from './ci-stats-workload';

export type HostFacts = {
  readonly platform: string;
  readonly arch: string;
  readonly cpuModel: string;
  readonly logicalCpus: number;
  readonly memoryGib: number;
};

export type FleetRunner = {
  readonly name: string;
  readonly os: string;
  readonly status: string;
  readonly busy: boolean;
  readonly labels: readonly string[];
};

export type StatsInput = {
  readonly generatedAt: string;
  readonly repository: string;
  readonly days: number;
  readonly budget: string | undefined;
  readonly goals: string | undefined;
  readonly have: string | undefined;
  readonly host: HostFacts;
  readonly workload: Workload;
  readonly variables: Readonly<Record<string, string>>;
  readonly fleet: readonly FleetRunner[] | undefined;
  readonly history: HistoryStats | undefined;
  /** Runs left out because GitHub would not return their jobs. */
  readonly skippedRuns: number;
};

const TARGET_MINUTES = [5, 10, 15, 30];
const UNSET = '_not given: ask the person, or rerun with the flag_';

export function duration(seconds: number): string {
  if (seconds < 120) return `${String(Math.round(seconds))} s`;
  if (seconds < 7200) return `${(seconds / 60).toFixed(1)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

export function table(
  headers: readonly string[],
  rows: readonly (readonly string[])[]
): string {
  if (rows.length === 0) return '_none_';
  const line = (cells: readonly string[]) => `| ${cells.join(' | ')} |`;
  return [
    line(headers),
    line(headers.map(() => '---')),
    ...rows.map(line),
  ].join('\n');
}

function dist(value: Distribution, format: (n: number) => string): string {
  if (value.count === 0) return 'n/a';
  return `${format(value.p50)} / ${format(value.p90)} / ${format(value.max)}`;
}

function num(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function renderStats(input: StatsInput): string {
  return [
    header(input),
    goalsSection(input),
    keyNumbers(input),
    declaredWorkload(input.workload),
    workflowDefinitions(input),
    input.history
      ? observedHistory(input.history, input.skippedRuns)
      : noHistory(),
    fleetSection(input),
    gapsSection(),
    summaryJson(input),
  ].join('\n\n');
}

function header(input: StatsInput): string {
  return [
    `# CI capacity brief: ${input.repository}`,
    '',
    `Generated ${input.generatedAt} by \`bun ci:stats\`.`,
    '',
    'This document is the input for sizing the hardware that hosts this',
    "repository's CI (GitHub Actions runners). It holds what the repo",
    'declares (task costs, workflow files) and what GitHub recorded (run and job',
    'history). An LLM reading it should:',
    '',
    '1. Turn the goals and budget below into a pool: node count, CPU, RAM, disk,',
    '   network, and runner agents per node.',
    '2. Show the arithmetic from the numbers here, and mark every assumption.',
    '3. Say which numbers are measured, which are estimated, and which are missing',
    '   (see "What this data cannot tell you").',
    '4. Compare owning hardware with renting, over 12 and 24 months.',
  ].join('\n');
}

function goalsSection(input: StatsInput): string {
  return [
    '## Goals, budget and hardware on hand',
    '',
    `- Budget: ${input.budget ?? UNSET}`,
    `- Goals: ${input.goals ?? UNSET}`,
    `- Hardware already owned: ${input.have ?? UNSET}`,
    `- This repo's own promises: a pull request's verdict in under ${duration(PR_VERIFY_SECONDS)}, every graph leaf under ${duration(LEAF_VERIFY_SECONDS)}, nine in ten leaves under ${duration(NARROW_VERIFY_SECONDS)}, on a warm runner (${duration(WARM_START_SECONDS)} warm start).`,
    `- Per-runner assumptions in the repo's own plan: at most ${String(SPEC_WORKER_CAP)} spec workers, about ${String(SPEC_WORKER_GIB)} GB each.`,
    "- Every job runs on a GitHub-hosted `ubuntu-24.04` runner, discarded after the job: the repository is public, so pull-request code never runs on a machine a deploy reuses. The account's concurrent-job allowance caps a run (`VERIFY_RUNNERS`), and the turbo cache key includes OS and arch.",
  ].join('\n');
}

function keyNumbers(input: StatsInput): string {
  const { load, split } = input.workload;
  const lines = [
    '## Key numbers',
    '',
    `- Cold gate (release profile): ${duration(load.coldSeconds)} of task time over ${String(load.tasks)} tasks in ${String(load.packages)} packages (${String(load.measuredTasks)} measured, ${String(load.estimatedTasks)} estimated).`,
    `- Pull-request profile: the whole gate, ${duration(split.prSeconds)} over ${String(split.prTasks)} tasks, the same gate Release runs.`,
    `- Longest indivisible task: ${split.longest[0]?.id ?? 'n/a'} at ${duration(split.longest[0]?.seconds ?? 0)}. No pool size makes a run faster than this plus setup.`,
    `- Shard cap: ${input.workload.workflows.find((w) => w.shardCap)?.shardCap ?? 'unknown'} per verify run (repo variable \`VERIFY_SHARDS\` overrides: ${input.variables['VERIFY_SHARDS'] ?? 'unset'}).`,
  ];
  if (input.history) lines.push(...historyKeyNumbers(input.history));
  return lines.join('\n');
}

function historyKeyNumbers(history: HistoryStats): string[] {
  const hours = history.workflows.reduce((s, w) => s + w.agentHoursPerDay, 0);
  const own = history.placement.find((p) => p.kind === 'self-hosted');
  return [
    `- Observed load, all runners: ${num(hours)} agent-hours per day averaged over ${num(history.days)} days (${String(history.runs)} runs), so about ${num(hours / 24)} agents busy around the clock on average.`,
    `- Self-hosted runners took jobs ${own?.firstAt ? `from ${own.firstAt.slice(0, 10)} to ${own.lastAt.slice(0, 10)}` : 'never in this window'}; the rest ran on GitHub-hosted VMs. Self-hosted numbers cover that short span only.`,
    `- Peak jobs running at once: ${String(history.running.peak)} on self-hosted (capped by the fleet), ${String(history.runningHosted.peak)} on GitHub-hosted (uncapped), ${String(history.runningAll.peak)} anywhere; ${String(history.demand.peak)} running or queued.`,
    `- Jobs running anywhere stay at or under ${String(history.runningAll.levelP90)} 90% of busy time and ${String(history.runningAll.levelP99)} 99% of it.`,
  ];
}

function declaredWorkload(workload: Workload): string {
  const { load, split } = workload;
  return [
    '## Declared workload (from the repo)',
    '',
    "Task seconds are the repo's measured costs (`verify-task-costs.json`) where it has them and a family median or 60 s otherwise. Specs are `test:spec` parts.",
    '',
    '### By task family',
    '',
    table(
      ['Family', 'Tasks', 'Task time'],
      load.families.map((f) => [f.family, String(f.tasks), duration(f.seconds)])
    ),
    '',
    `Spec parts: ${duration(load.specSeconds)} over ${String(load.specTasks)} tasks. Leaf packages (nothing depends on them) own ${duration(load.leafOwnP50)} of work at the median and ${duration(load.leafOwnP90)} at the 90th percentile.`,
    '',
    '### Longest tasks, whole gate',
    '',
    taskTable(split.longest),
    '',
    '### Longest tasks, pull-request profile',
    '',
    taskTable(split.longestPr),
    '',
    '### Largest dependency cones',
    '',
    'A source change reruns the changed package and every dependent. A cone is the work such a change makes.',
    '',
    table(
      ['Package', 'Packages', 'Task time', 'Longest task'],
      load.cones.map((c) => [
        c.name,
        String(c.packages),
        duration(c.seconds),
        `${c.poleTask} (${duration(c.poleSeconds)})`,
      ])
    ),
  ].join('\n');
}

function taskTable(rows: readonly TaskRow[]): string {
  return table(
    ['Task', 'Seconds', 'Source'],
    rows.map((row) => [row.id, String(row.seconds), row.source])
  );
}

function workflowDefinitions(input: StatsInput): string {
  const blocks = input.workload.workflows.map((workflow) => {
    const crons = workflow.crons.length
      ? `Schedule (UTC cron): ${workflow.crons.map((c) => `\`${c}\``).join(', ')}.`
      : 'No schedule.';
    return [
      `### ${workflow.name} (\`${workflow.file}\`)`,
      '',
      crons,
      '',
      table(
        ['Job', 'runs-on', 'Timeout'],
        workflow.jobs.map((job) => [
          job.id,
          job.runsOn || '(inherited)',
          job.timeoutMinutes === undefined
            ? 'default'
            : `${String(job.timeoutMinutes)} min`,
        ])
      ),
    ].join('\n');
  });
  return ['## Workflow definitions', ...blocks].join('\n\n');
}

function noHistory(): string {
  return [
    '## Observed history',
    '',
    '_Not collected (`--no-github`, or `gh` is missing or not signed in). Rerun with GitHub access for run durations, queue waits and concurrency._',
  ].join('\n');
}

function skippedNote(skippedRuns: number): string[] {
  if (skippedRuns === 0) return [];
  return [
    `**${String(skippedRuns)} runs were left out** because GitHub would not return their jobs after retries. Rerun \`bun ci:stats\` to fill them in; fetched runs are cached.`,
    '',
  ];
}

function observedHistory(history: HistoryStats, skippedRuns: number): string {
  return [
    '## Observed history (GitHub Actions)',
    '',
    ...skippedNote(skippedRuns),
    `${String(history.runs)} runs and ${String(history.jobs)} jobs, ${history.from.slice(0, 16)} to ${history.to.slice(0, 16)} UTC (${num(history.days)} days). Percentiles are p50 / p90 / max.`,
    '',
    'Per-run and per-job tables count every job that ran on a runner, and name the runner kind where hardware matters. **Self-hosted** is the fleet being replaced or grown; **GitHub-hosted** is a 2-core VM the workflows used before (and sometimes beside) it, so its durations differ from any self-hosted hardware, and it scales without a cap, which makes its concurrency the closest thing here to unconstrained demand. A run no runner took never executed and is left out of its per-run measures. Job durations are for jobs that succeeded: a failed job may have stopped early or hit a timeout.',
    '',
    '### Where jobs ran',
    '',
    placementTable(history),
    '',
    '### Per workflow',
    '',
    workflowTable(history.workflows),
    '',
    '### Agents needed to finish a typical run by a target time',
    '',
    'A floor: agent-seconds divided by the target, ignoring the longest-task limit and per-shard setup beyond what the history already contains.',
    '',
    targetTable(history.workflows),
    '',
    '### Per job family (busiest first)',
    '',
    familyTable(history),
    '',
    '### Concurrency',
    '',
    concurrencyTable(history),
    '',
    overlapTable(history.runningAll),
    '',
    '### Run starts by UTC hour',
    '',
    arrivalTable(history),
    '',
    '### Step durations (setup versus work)',
    '',
    table(
      ['Job family', 'Runner', 'Step', 'p50 / p90 / max'],
      history.steps
        .slice(0, 24)
        .map((s) => [s.family, s.kind, s.step, dist(s.duration, duration)])
    ),
  ].join('\n');
}

function workflowTable(workflows: readonly WorkflowStats[]): string {
  return table(
    [
      'Workflow',
      'Runs',
      'Executed',
      'Runs/day',
      'Triggers',
      'Outcomes',
      'Wall clock (finished)',
      'Wall clock (passed)',
      'Jobs/run',
      'Shards/run',
      'Agent time/run',
      'Agent-hours/day',
    ],
    workflows.map((w) => [
      w.workflow,
      String(w.runs),
      String(w.executedRuns),
      num(w.runsPerDay),
      pairs(w.events),
      pairs(w.conclusions),
      dist(w.wallClock, duration),
      dist(w.passingWallClock, duration),
      dist(w.jobsPerRun, num),
      dist(w.shardsPerRun, num),
      dist(w.agentSecondsPerRun, duration),
      num(w.agentHoursPerDay),
    ])
  );
}

function placementTable(history: HistoryStats): string {
  const labels = {
    'self-hosted': 'Self-hosted runner',
    'github-hosted': 'GitHub-hosted VM',
    none: 'No runner recorded (queued until cancelled, skipped, or failed to start)',
  } as const;
  return table(
    [
      'Where',
      'Jobs',
      'Agent-hours',
      'Active between (UTC)',
      'Wait p50 / p90 / max',
    ],
    history.placement.map((p) => [
      labels[p.kind],
      String(p.jobs),
      p.kind === 'none' ? '-' : num(p.agentHours),
      p.firstAt ? `${p.firstAt.slice(0, 16)} to ${p.lastAt.slice(0, 16)}` : '-',
      dist(p.wait, duration),
    ])
  );
}

function pairs(record: Readonly<Record<string, number>>): string {
  return Object.entries(record)
    .map(([key, count]) => `${key} ${String(count)}`)
    .join(', ');
}

function targetTable(workflows: readonly WorkflowStats[]): string {
  return table(
    [
      'Workflow',
      'Typical agent time',
      ...TARGET_MINUTES.map((m) => `${String(m)} min`),
    ],
    workflows.map((w) => [
      w.workflow,
      `${duration(w.agentSecondsPerRun.p50)} (p90 ${duration(w.agentSecondsPerRun.p90)})`,
      ...TARGET_MINUTES.map(
        (m) =>
          `${String(Math.ceil(w.agentSecondsPerRun.p50 / (m * 60)))} (p90 ${String(Math.ceil(w.agentSecondsPerRun.p90 / (m * 60)))})`
      ),
    ])
  );
}

function familyTable(history: HistoryStats): string {
  return table(
    [
      'Workflow',
      'Job family',
      'Runner',
      'Jobs',
      'Passed',
      'Failed',
      'Cancelled',
      'Passed duration p50 / p90 / max',
      'Queue wait p50 / p90 / max',
    ],
    history.families
      .slice(0, 30)
      .map((f) => [
        f.workflow,
        f.family,
        f.kind,
        String(f.jobs),
        String(f.succeeded),
        String(f.failed),
        String(f.cancelled),
        dist(f.duration, duration),
        dist(f.queueWait, duration),
      ])
  );
}

function concurrencyTable(history: HistoryStats): string {
  const row = (label: string, c: ConcurrencyStats) => [
    label,
    String(c.peak),
    c.peakAt.slice(0, 16),
    pairs(c.peakByWorkflow),
    `${String(c.levelP50)} / ${String(c.levelP90)} / ${String(c.levelP99)}`,
    duration(c.busySeconds),
  ];
  return table(
    [
      'Measure',
      'Peak',
      'Peak at (UTC)',
      'Peak made of',
      'While busy p50 / p90 / p99',
      'Busy time',
    ],
    [
      row('Running on self-hosted (capped by fleet size)', history.running),
      row('Running on GitHub-hosted (uncapped)', history.runningHosted),
      row('Running anywhere', history.runningAll),
      row('Running or queued for a runner, anywhere', history.demand),
    ]
  );
}

function overlapTable(running: ConcurrencyStats): string {
  const rows = Object.entries(running.overlapSeconds)
    .sort((a, b) => b[1] - a[1])
    .map(([pair, seconds]) => [pair, duration(seconds)]);
  return [
    'Time two workflows had jobs running at once (any runner):',
    '',
    table(['Workflows', 'Overlap'], rows),
  ].join('\n');
}

function arrivalTable(history: HistoryStats): string {
  const hours = Array.from({ length: 24 }, (_, hour) => String(hour));
  return table(
    ['Trigger', ...hours],
    Object.entries(history.arrivals).map(([event, counts]) => [
      event,
      ...counts.map(String),
    ])
  );
}

function fleetSection(input: StatsInput): string {
  const lines = [
    '## Current fleet and this machine',
    '',
    `This machine (where \`ci:stats\` ran): ${input.host.platform} ${input.host.arch}, ${input.host.cpuModel}, ${String(input.host.logicalCpus)} logical CPUs, ${String(input.host.memoryGib)} GiB RAM.`,
    '',
  ];
  if (input.fleet === undefined)
    lines.push('_Runner list unavailable (needs repository admin access)._');
  else
    lines.push(
      table(
        ['Runner', 'OS', 'Status', 'Busy', 'Labels'],
        input.fleet.map((r) => [
          r.name,
          r.os,
          r.status,
          r.busy ? 'yes' : 'no',
          r.labels.join(', '),
        ])
      )
    );
  if (input.history && input.history.runners.length > 0)
    lines.push(
      '',
      'Runners that took jobs in the window:',
      '',
      table(
        ['Runner', 'Jobs', 'Busy time'],
        input.history.runners.map((r) => [
          r.runner,
          String(r.jobs),
          duration(r.busySeconds),
        ])
      )
    );
  return lines.join('\n');
}

function gapsSection(): string {
  return [
    '## What this data cannot tell you',
    '',
    '- **Peak memory and CPU per job.** GitHub does not report them. Per-agent RAM and cores are assumptions (the repo plans about 2 GB per spec worker and one core per shard) until a probe measures a shard.',
    '- **Unconstrained demand.** Self-hosted concurrency and shard counts are capped by the runners online at the time. The GitHub-hosted rows are the uncapped view, up to the shard cap above.',
    '- **Hardware speed.** Durations come from two different machines (the self-hosted fleet and 2-core GitHub-hosted VMs); a faster or slower CPU scales them.',
    '- **Disk and network.** Checkout, `node_modules`, the turbo cache and artifact transfer sizes are not measured here.',
    '- **Cost.** Prices are not in this document. Ask the LLM to look them up for the current date and region.',
  ].join('\n');
}

function summaryJson(input: StatsInput): string {
  const { load, split } = input.workload;
  const summary = {
    repository: input.repository,
    coldSeconds: load.coldSeconds,
    prProfileSeconds: split.prSeconds,
    releaseOnlySeconds: split.releaseOnlySeconds,
    longestTask: split.longest[0],
    history: input.history
      ? {
          runs: input.history.runs,
          peakRunning: input.history.running.peak,
          peakDemand: input.history.demand.peak,
          agentHoursPerDay: input.history.workflows.map((w) => ({
            workflow: w.workflow,
            hours: w.agentHoursPerDay,
          })),
        }
      : null,
  };
  return [
    '## Machine-readable summary',
    '',
    '```json',
    JSON.stringify(summary, null, 2),
    '```',
  ].join('\n');
}

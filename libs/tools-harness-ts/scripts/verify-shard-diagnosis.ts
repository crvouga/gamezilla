/**
 * Why a Verify shard went red, said plainly. A shard fails for four different
 * reasons that used to look the same in the log (a stack trace naming one
 * task): it ran out of time, a task blew its own budget, a task failed, or the
 * shard stopped before a task finished. This module names which one, lists the
 * tasks involved with their commands and durations, and says what to do next.
 *
 * Pure: the shard runner feeds it what the task stream observed and prints,
 * annotates and summarizes the result (`verify-shard-run.ts`).
 */

export type StopReason =
  /** The whole shard hit its wall-clock deadline and was killed. */
  | { readonly kind: 'shard-deadline'; readonly deadlineSeconds: number }
  /** One or more tasks ran past their own budget and the shard was killed. */
  | { readonly kind: 'task-budget' };

export type RunningTask = { readonly taskId: string; readonly seconds: number };
export type FinishedTask = RunningTask;
export type FailedTaskFacts = RunningTask & {
  /** The last lines the task printed. */
  readonly tail: string;
  readonly detail: string;
};

/** What the task stream saw while the shard ran. */
export type StreamSnapshot = {
  readonly running: readonly RunningTask[];
  readonly finished: readonly FinishedTask[];
  readonly failed: readonly FailedTaskFacts[];
  /** Tasks over their own budget when the shard was stopped. */
  readonly overBudget: readonly (RunningTask & { readonly budget: number })[];
};

export type PlannedTask = {
  readonly taskId: string;
  readonly command: string;
  readonly seconds: number;
  readonly hit: boolean;
};

export type ShardFacts = {
  readonly index: number;
  readonly stop: StopReason | null;
  readonly planned: readonly PlannedTask[];
  readonly estimatedSeconds: number;
  readonly actualSeconds: number;
  readonly stream: StreamSnapshot;
  /** Tasks Turbo recorded as failed in its run summary (exit code). */
  readonly summaryFailures: readonly { taskId: string; exitCode: number }[];
  /** Prerequisite artifacts this shard needed but could not restore. */
  readonly missingPrerequisites: readonly string[];
  /** Pre-formatted per-task budget overruns from the run summary, if any. */
  readonly budgetOverruns: string;
};

export type DiagnosisKind =
  | 'shard-deadline'
  | 'task-budget'
  | 'task-failed'
  | 'prerequisite-missing'
  | 'budget-overrun'
  | 'incomplete';

export type Diagnosis = {
  readonly kind: DiagnosisKind;
  /** One line: what is wrong. Used for the annotation and the verdict. */
  readonly headline: string;
  /** The full plain-text report for the job log. */
  readonly text: string;
  /** The same report for the run summary page. */
  readonly markdown: string;
};

const RULE = '='.repeat(78);
const MAX_LISTED = 12;

const fmt = (seconds: number): string => `${seconds.toFixed(0)}s`;

function command(planned: readonly PlannedTask[], taskId: string): string {
  return planned.find((task) => task.taskId === taskId)?.command ?? '(unknown)';
}

function listed<T>(items: readonly T[], line: (item: T) => string): string[] {
  const shown = items.slice(0, MAX_LISTED).map(line);
  if (items.length > MAX_LISTED)
    shown.push(`  … and ${items.length - MAX_LISTED} more`);
  return shown;
}

/** Tasks the shard was asked to run that neither finished nor failed nor were running. */
export function neverStarted(facts: ShardFacts): PlannedTask[] {
  const seen = new Set([
    ...facts.stream.finished.map((task) => task.taskId),
    ...facts.stream.running.map((task) => task.taskId),
    ...facts.stream.failed.map((task) => task.taskId),
  ]);
  return facts.planned.filter((task) => !task.hit && !seen.has(task.taskId));
}

function classify(facts: ShardFacts): DiagnosisKind {
  if (facts.stop?.kind === 'shard-deadline') return 'shard-deadline';
  if (facts.stop?.kind === 'task-budget') return 'task-budget';
  if (facts.stream.failed.length > 0 || facts.summaryFailures.length > 0)
    return 'task-failed';
  if (facts.missingPrerequisites.length > 0) return 'prerequisite-missing';
  if (facts.budgetOverruns) return 'budget-overrun';
  return 'incomplete';
}

function headlineOf(kind: DiagnosisKind, facts: ShardFacts): string {
  const shard = `Verify shard ${facts.index}`;
  switch (kind) {
    case 'shard-deadline':
      return `${shard} RAN OUT OF TIME (${(facts.stop as { deadlineSeconds: number }).deadlineSeconds}s deadline) — a capacity problem, no test in it was shown to be wrong`;
    case 'task-budget':
      return `${shard} STOPPED: ${facts.stream.overBudget.map((task) => task.taskId).join(', ') || 'a task'} ran past its own time budget`;
    case 'task-failed': {
      const ids = [
        ...new Set([
          ...facts.stream.failed.map((task) => task.taskId),
          ...facts.summaryFailures.map((task) => task.taskId),
        ]),
      ];
      return `${shard} FAILED: ${ids.length} task${ids.length === 1 ? '' : 's'} failed — ${ids.slice(0, 3).join(', ')}${ids.length > 3 ? ', …' : ''}`;
    }
    case 'prerequisite-missing':
      return `${shard} COULD NOT START: ${facts.missingPrerequisites.length} prerequisite artifact${facts.missingPrerequisites.length === 1 ? ' is' : 's are'} missing`;
    case 'budget-overrun':
      return `${shard} FAILED: a task finished but took longer than its time budget`;
    case 'incomplete':
      return `${shard} FAILED: it stopped before every task finished, and Turbo reported no failing task`;
  }
}

function whatHappened(kind: DiagnosisKind, facts: ShardFacts): string[] {
  const missCount = facts.planned.filter((task) => !task.hit).length;
  const hits = facts.planned.length - missCount;
  switch (kind) {
    case 'shard-deadline': {
      const deadline = (facts.stop as { deadlineSeconds: number })
        .deadlineSeconds;
      return [
        `Shard ${facts.index} was given ${deadline}s and was still working when the clock ran out,`,
        'so it was killed. This is NOT a failing test. The work assigned to this shard',
        'did not fit in the time the plan thought it would.',
        '',
        `  assigned     ${facts.planned.length} tasks (${hits} already cached, ${missCount} to execute)`,
        `  estimated    ${fmt(facts.estimatedSeconds)} of task time`,
        `  actual       ${fmt(facts.actualSeconds)} wall clock (deadline ${deadline}s)`,
      ];
    }
    case 'task-budget':
      return [
        'A task ran longer than the time budget it is allowed, so the shard was stopped',
        'rather than letting it hang. The task did not necessarily fail; it was too slow.',
      ];
    case 'task-failed':
      return [
        'A task in this shard exited with an error. The failing task, its command and',
        'the end of its output are below. Fix the cause shown there.',
      ];
    case 'prerequisite-missing':
      return [
        'This shard needs build outputs that an earlier shard should have cached, and',
        'they are not in the cache. The tasks that depend on them were not run.',
      ];
    case 'budget-overrun':
      return [
        'Every task passed, but at least one took longer than its time budget.',
        'Budgets are enforced so a slow task is noticed before it times out.',
      ];
    case 'incomplete':
      return [
        'The shard process ended before every assigned task reported a result, and no',
        'task is known to have failed. Look above this report for a crash, an',
        'out-of-memory kill or a cancelled runner.',
      ];
  }
}

function advice(kind: DiagnosisKind, facts: ShardFacts): string[] {
  switch (kind) {
    case 'shard-deadline': {
      const slowest = [...facts.stream.finished].sort(
        (a, b) => b.seconds - a.seconds
      )[0];
      return [
        'Tasks that finished are already in the cache. Starting a new Verify PR run',
        '(push a commit, or close and reopen the pull request) gives this work',
        'fewer tasks, so it usually passes on the second run.',
        'If it keeps timing out, the planner has stale cost estimates for these tasks:',
        '  bun run libs/tools-harness-ts/scripts/verify-task-costs.ts --harvest <run id>',
        slowest
          ? `Slowest finished here: ${slowest.taskId} (${fmt(slowest.seconds)}).`
          : 'Nothing finished in this shard before the deadline.',
      ];
    }
    case 'task-budget':
      return [
        'Reproduce locally with the command shown for the task below, or raise the',
        'budget in libs/tools-harness-ts/scripts/verify-budget.ts only once the task is made',
        'faster as far as it can be.',
      ];
    case 'task-failed':
      return [
        'Reproduce locally: run the command shown for the failing task, from its',
        'directory, or `bun run --filter <package> <task>`. Then run `bun verify`.',
      ];
    case 'prerequisite-missing':
      return [
        'Look for the earlier failed shard (prerequisites run first). Fix that and',
        'start a new run.',
      ];
    case 'budget-overrun':
      return ['Make the named task faster; do not just raise its budget.'];
    case 'incomplete':
      return [
        'Re-run once. If it repeats, open the "Run shard" step log of this job and',
        'read the last output before the process ended.',
      ];
  }
}

type Section = { title: string; lines: string[] };

function processSections(kind: DiagnosisKind, facts: ShardFacts): Section[] {
  const sections: Section[] = [];
  const running = facts.stream.running;
  if (running.length > 0)
    sections.push({
      title:
        kind === 'shard-deadline'
          ? 'STILL RUNNING WHEN IT WAS KILLED'
          : 'RUNNING WHEN THE SHARD STOPPED',
      lines: listed(
        running,
        (task) =>
          `  ${task.taskId}  running ${fmt(task.seconds)}\n      ${command(facts.planned, task.taskId)}`
      ),
    });
  if (facts.stream.overBudget.length > 0)
    sections.push({
      title: 'OVER ITS OWN TIME BUDGET',
      lines: listed(
        facts.stream.overBudget,
        (task) =>
          `  ${task.taskId}  ran ${fmt(task.seconds)}, budget ${fmt(task.budget)}\n      ${command(facts.planned, task.taskId)}`
      ),
    });
  return sections;
}

function failedTaskLines(facts: ShardFacts): string[] {
  return facts.stream.failed.flatMap((task) => [
    `  ${task.taskId}  failed after ${fmt(task.seconds)}`,
    `      command: ${command(facts.planned, task.taskId)}`,
    ...(task.detail ? [`      ${task.detail}`] : []),
    ...(task.tail
      ? [
          '      --- last output ---',
          ...task.tail.split('\n').map((line) => `      | ${line}`),
          '      --------------------',
        ]
      : []),
  ]);
}

function failureSections(facts: ShardFacts): Section[] {
  const sections: Section[] = [];
  if (facts.stream.failed.length > 0)
    sections.push({
      title: 'FAILED TASKS (with the end of their output)',
      lines: failedTaskLines(facts),
    });
  const failedIds = new Set(facts.stream.failed.map((task) => task.taskId));
  const extra = facts.summaryFailures.filter(
    (task) => !failedIds.has(task.taskId)
  );
  if (extra.length > 0)
    sections.push({
      title: 'TASKS TURBO REPORTED AS FAILED',
      lines: listed(
        extra,
        (task) =>
          `  ${task.taskId}  exit code ${task.exitCode}\n      ${command(facts.planned, task.taskId)}`
      ),
    });
  if (facts.missingPrerequisites.length > 0)
    sections.push({
      title: 'MISSING PREREQUISITE ARTIFACTS',
      lines: listed(facts.missingPrerequisites, (id) => `  ${id}`),
    });
  if (facts.budgetOverruns)
    sections.push({
      title: 'TIME BUDGET OVERRUNS',
      lines: facts.budgetOverruns.split('\n').map((line) => `  ${line}`),
    });
  return sections;
}

function progressSections(kind: DiagnosisKind, facts: ShardFacts): Section[] {
  const sections: Section[] = [];
  const unstarted = neverStarted(facts);
  if (unstarted.length > 0 && kind !== 'task-failed')
    sections.push({
      title: `NEVER STARTED (${unstarted.length}) — the shard stopped before reaching them`,
      lines: listed(unstarted, (task) => `  ${task.taskId}`),
    });
  if (facts.stream.finished.length > 0 && kind === 'shard-deadline')
    sections.push({
      title: `FINISHED OK BEFORE THE STOP (${facts.stream.finished.length}; slowest first)`,
      lines: listed(
        [...facts.stream.finished].sort((a, b) => b.seconds - a.seconds),
        (task) => {
          const estimate = facts.planned.find(
            (planned) => planned.taskId === task.taskId
          )?.seconds;
          return `  ${task.taskId}  took ${fmt(task.seconds)}${estimate === undefined ? '' : ` (planned ${fmt(estimate)})`}`;
        }
      ),
    });
  return sections;
}

function render(
  headline: string,
  sections: readonly Section[]
): {
  text: string;
  markdown: string;
} {
  const text = [
    '',
    RULE,
    `  ✖ ${headline}`,
    RULE,
    ...sections.flatMap((section) => [
      '',
      `── ${section.title}`,
      ...section.lines,
    ]),
    '',
    RULE,
    '',
  ].join('\n');
  const markdown = [
    `## ❌ ${headline}`,
    '',
    ...sections.flatMap((section) => [
      `### ${section.title}`,
      '',
      '```text',
      ...section.lines,
      '```',
      '',
    ]),
  ].join('\n');
  return { text, markdown };
}

export function diagnoseShard(facts: ShardFacts): Diagnosis {
  const kind = classify(facts);
  const headline = headlineOf(kind, facts);
  const sections: Section[] = [
    { title: 'WHAT HAPPENED', lines: whatHappened(kind, facts) },
    ...processSections(kind, facts),
    ...failureSections(facts),
    ...progressSections(kind, facts),
    { title: 'WHAT TO DO', lines: advice(kind, facts) },
  ];
  return { kind, headline, ...render(headline, sections) };
}

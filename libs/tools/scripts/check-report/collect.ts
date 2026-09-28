// @io-wall-ok — reads turbo run summaries, task logs and harness buckets.
/**
 * A run's {@link CheckFragment}, read off disk right after turbo finishes:
 * the plan's tasks overlaid with turbo's `--summarize` run summary, the log
 * tail of every task worth reading (failures, the spec gates), and the
 * harness bucket of every spec part turbo ran or restored.
 *
 * Only what this run touched is read. A task the plan found cached and turbo
 * never ran left nothing fresh on disk: its log and bucket there, if any,
 * are some earlier run's, so the report says "cached" and shows neither.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { readScenarioBucket } from '@libs/harness/scenario-report';
import {
  type CheckFragment,
  type PlanTask,
  planStatus,
  type ReportTask,
  type Scm,
  SPEC_GATE_TASKS,
  type SpecRun,
  type SummaryTask,
  splitTaskId,
  summarySeconds,
  summaryStatus,
} from './model';

const LOG_TAIL_LINES = 400;
const LOG_TAIL_CHARS = 64_000;
const SPEC_PART = /^test:spec:(\d+)$/;

export function readScm(repoRoot: string): Scm | null {
  const git = (args: readonly string[]): string =>
    spawnSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).stdout.trim();
  const sha = git(['rev-parse', 'HEAD']);
  if (sha === '') return null;
  return { sha, branch: git(['rev-parse', '--abbrev-ref', 'HEAD']) };
}

function stripAnsi(text: string): string {
  return text.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '');
}

function logTail(repoRoot: string, logFile: unknown): string | null {
  if (typeof logFile !== 'string') return null;
  const path = join(repoRoot, logFile);
  if (!existsSync(path)) return null;
  const lines = stripAnsi(readFileSync(path, 'utf8')).split('\n');
  const tail = lines.slice(-LOG_TAIL_LINES).join('\n');
  return tail.length > LOG_TAIL_CHARS ? tail.slice(-LOG_TAIL_CHARS) : tail;
}

function overlay(
  repoRoot: string,
  base: ReportTask | undefined,
  task: SummaryTask
): ReportTask | null {
  if (typeof task.taskId !== 'string') return null;
  const status = summaryStatus(task);
  const hash = typeof task.hash === 'string' ? task.hash : (base?.hash ?? '');
  if (status === null) return base ?? null;
  const keepLog = status === 'failed' || SPEC_GATE_TASKS.includes(task.taskId);
  return {
    taskId: task.taskId,
    hash,
    status,
    seconds: summarySeconds(task),
    log: keepLog ? logTail(repoRoot, task.logFile) : null,
  };
}

/**
 * The bucket of a spec part this run ran or restored:
 * `<pkg>/.turbo/turbo-test:spec:<k>.log` → `<pkg>/.cache/harness-report/part-<k>`.
 */
async function specRunOf(
  repoRoot: string,
  task: SummaryTask
): Promise<SpecRun | null> {
  if (typeof task.taskId !== 'string' || typeof task.logFile !== 'string') {
    return null;
  }
  if (summaryStatus(task) === null) return null;
  const part = SPEC_PART.exec(splitTaskId(task.taskId)[1])?.[1];
  if (part === undefined) return null;
  const packageDir = dirname(dirname(join(repoRoot, task.logFile)));
  const bucket = join(packageDir, '.cache/harness-report', `part-${part}`);
  if (!existsSync(bucket)) return null;
  try {
    const read = await readScenarioBucket(bucket);
    return read === null ? null : { label: task.taskId, ...read };
  } catch {
    return null;
  }
}

export type RunInput = {
  readonly repoRoot: string;
  /** Every task the plan named; null when planning failed. */
  readonly plan: readonly PlanTask[] | null;
  /** This run's summary tasks; null when turbo did not run. */
  readonly summary: readonly SummaryTask[] | null;
  readonly exitCode: number | null;
};

export async function collectFragment(input: RunInput): Promise<CheckFragment> {
  const byId = new Map<string, ReportTask>();
  for (const task of input.plan ?? []) {
    byId.set(task.taskId, {
      taskId: task.taskId,
      hash: task.hash,
      status: planStatus(task),
      seconds: null,
      log: null,
    });
  }
  const specRuns: SpecRun[] = [];
  for (const task of input.summary ?? []) {
    const id = typeof task.taskId === 'string' ? task.taskId : '';
    const merged = overlay(input.repoRoot, byId.get(id), task);
    if (merged !== null) byId.set(merged.taskId, merged);
    const specRun = await specRunOf(input.repoRoot, task);
    if (specRun !== null) specRuns.push(specRun);
  }
  return {
    source: input.summary === null ? 'plan' : 'run',
    scm: readScm(input.repoRoot),
    tasks: [...byId.values()],
    exitCode: input.exitCode,
    specRuns,
  };
}

#!/usr/bin/env bun
// @io-wall-ok — CI aggregation entry; reads shard evidence, writes the verdict.
/**
 * `check:verify`: one verdict for a full Check run. Every shard's
 * `results/shard-<n>.json` (inside its evidence tar) is grouped into
 * suites — typecheck, unit tests, Gherkin specs, Quint models, … — so a red
 * run names every failing task at once, with the artifact that holds its
 * evidence. A planned task with no verdict (a crashed or cancelled shard)
 * fails, as does any upstream job that did not succeed.
 *
 * Writes `.cache/check-ci/verdict.{json,md,junit.xml}`, appends the
 * Markdown to `GITHUB_STEP_SUMMARY`, prints the table and exits 1 on any
 * failure.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { restorePlan } from './check-plan-transfer';
import type { Result } from './check-shard-results';

export type ShardResult = {
  readonly index: number;
  readonly verdict: number;
  readonly tasks: readonly Result[];
};

export type FailedTask = {
  readonly taskId: string;
  readonly shard: number | null;
  readonly exitCode: number;
  readonly reason: 'failed' | 'interrupted' | 'missing';
};

export type Suite = {
  readonly name: string;
  readonly tasks: number;
  readonly failed: readonly FailedTask[];
};

export type Verdict = {
  readonly passed: boolean;
  readonly suites: readonly Suite[];
  readonly jobs: readonly { name: string; result: string }[];
  readonly failures: number;
};

/** Suite order is the report order; the first matching rule wins. */
const SUITES: readonly (readonly [string, RegExp])[] = [
  ['Typecheck', /^tc$/],
  ['Lint and boundaries', /^(lint|check:root-lint)$/],
  ['Unit tests', /^test$/],
  ['Contract tests', /^test:contract$/],
  ['Gherkin specs', /^test:spec(:\d+)?$/],
  ['Quint models', /^check:models$/],
  ['Synthetic Population', /^check:synthetic-population(?:-foundation)?$/],
  ['Spec and conformance', /^ci:(specs|conformance|spec-ownership|goals)$/],
  ['Database schema', /^check:schema-evolution$/],
  ['Security', /^(check:secrets|ci:audit)$/],
  ['Build', /^(build|src|check:worker-bundle|check:offline-shell)$/],
  ['Repository gates', /./],
];

export function suiteOf(taskId: string): string {
  const task = taskId.slice(taskId.indexOf('#') + 1);
  return SUITES.find(([, pattern]) => pattern.test(task))![0];
}

function failure(result: Result, shard: number): FailedTask {
  return {
    taskId: result.taskId,
    shard,
    exitCode: result.exitCode,
    reason: result.interrupted ? 'interrupted' : 'failed',
  };
}

/** A task fails if any shard recorded it failing or none recorded it at all. */
export function summarize(args: {
  readonly planned: readonly string[];
  readonly shards: readonly ShardResult[];
  readonly jobs: readonly { name: string; result: string }[];
}): Verdict {
  const failed = new Map<string, FailedTask>();
  const seen = new Set<string>();
  for (const shard of [...args.shards].sort((a, b) => a.index - b.index))
    for (const result of shard.tasks) {
      seen.add(result.taskId);
      if (!result.passed && !failed.has(result.taskId))
        failed.set(result.taskId, failure(result, shard.index));
    }
  for (const taskId of args.planned)
    if (!seen.has(taskId))
      failed.set(taskId, {
        taskId,
        shard: null,
        exitCode: 1,
        reason: 'missing',
      });
  const ids = new Set([...args.planned, ...seen]);
  const suites = SUITES.map(([name]) => ({
    name,
    tasks: [...ids].filter((id) => suiteOf(id) === name).length,
    failed: [...failed.values()]
      .filter((task) => suiteOf(task.taskId) === name)
      .sort((a, b) => (a.taskId < b.taskId ? -1 : 1)),
  })).filter((suite) => suite.tasks > 0);
  const badJobs = args.jobs.filter((job) => job.result !== 'success');
  return {
    passed: failed.size === 0 && badJobs.length === 0 && ids.size > 0,
    suites,
    jobs: args.jobs,
    failures: failed.size,
  };
}

/** The table a person or an agent reads first. */
export function formatTable(verdict: Verdict): string {
  const badJobs = verdict.jobs.filter((job) => job.result !== 'success');
  const width = Math.max(
    20,
    ...verdict.suites.map((suite) => suite.name.length),
    ...badJobs.map((job) => `job ${job.name}`.length)
  );
  const lines = ['Release verification', ''];
  for (const suite of verdict.suites)
    lines.push(
      `${suite.name.padEnd(width + 2)}${suite.failed.length ? 'FAIL' : 'PASS'}${suite.failed.length ? `   ${suite.failed.length}` : ''}`
    );
  for (const job of badJobs)
    lines.push(
      `${`job ${job.name}`.padEnd(width + 2)}${job.result.toUpperCase()}`
    );
  const red = verdict.suites.filter((suite) => suite.failed.length).length;
  lines.push('', verdictLine(verdict, red, badJobs.length));
  return lines.join('\n');
}

function verdictLine(verdict: Verdict, red: number, badJobs: number): string {
  if (verdict.passed) return 'Every required gate passed';
  if (verdict.suites.length === 0)
    return `No task verdicts: ${badJobs} jobs did not succeed`;
  return `${verdict.failures} total failures across ${red} suites`;
}

function evidenceOf(task: FailedTask): string {
  if (task.shard === null) return 'no verdict (shard crashed or cancelled)';
  return `\`check-evidence-${task.shard}\`, \`observability-traces-*-${task.shard}\``;
}

export function formatMarkdown(verdict: Verdict, runUrl: string): string {
  const lines = [
    `## ${verdict.passed ? '✅' : '❌'} Release verification`,
    '',
    '| Suite | Result | Failures | Tasks |',
    '|---|---|---|---|',
    ...verdict.suites.map(
      (suite) =>
        `| ${suite.name} | ${suite.failed.length ? 'FAIL' : 'PASS'} | ${suite.failed.length} | ${suite.tasks} |`
    ),
    '',
  ];
  for (const job of verdict.jobs.filter((job) => job.result !== 'success'))
    lines.push(`- job \`${job.name}\`: **${job.result}**`);
  for (const suite of verdict.suites.filter((suite) => suite.failed.length)) {
    lines.push('', `### ${suite.name}`, '');
    for (const task of suite.failed)
      lines.push(
        `- \`${task.taskId}\` — ${task.reason} (exit ${task.exitCode}); evidence ${evidenceOf(task)}`
      );
  }
  lines.push('', `Logs and artifacts: ${runUrl}`, '');
  return lines.join('\n');
}

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** One `<testsuite>` per suite, one `<testcase>` per failing task. */
export function formatJunit(verdict: Verdict): string {
  const suites = verdict.suites.map((suite) => {
    const cases = suite.failed.map(
      (task) =>
        `    <testcase classname="${escapeXml(suite.name)}" name="${escapeXml(task.taskId)}"><failure message="${task.reason} (exit ${task.exitCode})">${escapeXml(evidenceOf(task))}</failure></testcase>`
    );
    return [
      `  <testsuite name="${escapeXml(suite.name)}" tests="${suite.tasks}" failures="${suite.failed.length}">`,
      ...cases,
      '  </testsuite>',
    ].join('\n');
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="check" failures="${verdict.failures}">\n${suites.join('\n')}\n</testsuites>\n`;
}

const ROOT = join(import.meta.dirname, '../../..');
const DIRECTORY = join(ROOT, '.cache/check-ci');

function readEvidence(): {
  planned: string[];
  shards: ShardResult[];
} {
  const payload = join(DIRECTORY, 'plan.payload');
  if (existsSync(payload)) restorePlan(readFileSync(payload, 'utf8'));
  const planPath = join(DIRECTORY, 'plan.json');
  const planned = existsSync(planPath)
    ? (
        JSON.parse(readFileSync(planPath, 'utf8')) as {
          tasks: { taskId: string }[];
        }
      ).tasks.map((task) => task.taskId)
    : [];
  const results = join(DIRECTORY, 'results');
  const shards = existsSync(results)
    ? readdirSync(results)
        .filter((file) => /^shard-\d+\.json$/.test(file))
        .map(
          (file) =>
            JSON.parse(readFileSync(join(results, file), 'utf8')) as ShardResult
        )
    : [];
  return { planned, shards };
}

function main(env: NodeJS.ProcessEnv): number {
  const verdict = summarize({
    ...readEvidence(),
    jobs: [
      ['check:plan', env['PLAN_RESULT']],
      ['check:shards', env['SHARD_RESULT']],
      ['check:consumers', env['CONSUMER_RESULT']],
    ].map(([name, result]) => ({ name: name!, result: result ?? 'unknown' })),
  });
  const runUrl = `${env['GITHUB_SERVER_URL'] ?? 'https://github.com'}/${env['GITHUB_REPOSITORY'] ?? ''}/actions/runs/${env['GITHUB_RUN_ID'] ?? ''}`;
  const markdown = formatMarkdown(verdict, runUrl);
  mkdirSync(DIRECTORY, { recursive: true });
  writeFileSync(join(DIRECTORY, 'verdict.json'), JSON.stringify(verdict));
  writeFileSync(join(DIRECTORY, 'verdict.md'), markdown);
  writeFileSync(join(DIRECTORY, 'verdict.junit.xml'), formatJunit(verdict));
  if (env['GITHUB_STEP_SUMMARY'])
    appendFileSync(env['GITHUB_STEP_SUMMARY'], markdown);
  console.log(formatTable(verdict));
  for (const suite of verdict.suites)
    for (const task of suite.failed)
      console.log(`::error title=${suite.name}::${task.taskId} ${task.reason}`);
  return verdict.passed ? 0 : 1;
}

if (import.meta.main) process.exit(main(process.env));

#!/usr/bin/env bun
/**
 * Always-run CI helper: append a workflow job status block (and, on failure,
 * the failed tests' trace queries) to `GITHUB_STEP_SUMMARY`.
 *
 * Expects:
 * - `WORKFLOW_JOB` — job label, e.g. `check` / `deploy:dev`
 * - `WORKFLOW_OUTCOME` — `success` | `failure` | `cancelled` | `skipped`
 */
// @io-wall-ok — CI entry; reads trace artifacts + writes GITHUB_STEP_SUMMARY
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type FailedTestTrace,
  failedTestTraceMarkdown,
  failedTestTracesFromNdjson,
} from './workflow-observability';

function iconFor(result: string): string {
  switch (result) {
    case 'success':
      return '✅';
    case 'failure':
      return '❌';
    case 'cancelled':
      return '⚠️';
    case 'skipped':
      return '⏭️';
    default:
      return '❔';
  }
}

function buildStatusMarkdown(
  name: string,
  outcome: string,
  failedTests: readonly FailedTestTrace[]
): string {
  const lines: string[] = [];
  const repo = (process.env['GITHUB_REPOSITORY'] ?? '').trim();
  const runId = (process.env['GITHUB_RUN_ID'] ?? '').trim();
  const server = (
    process.env['GITHUB_SERVER_URL'] ?? 'https://github.com'
  ).trim();
  const sha = (process.env['GITHUB_SHA'] ?? '').trim();
  const ref = (process.env['GITHUB_REF_NAME'] ?? '').trim();
  const event = (process.env['GITHUB_EVENT_NAME'] ?? '').trim();
  const actor = (process.env['GITHUB_ACTOR'] ?? '').trim();
  const secretsEnv = (process.env['SECRETS_ENV'] ?? '').trim();

  lines.push(`## ${iconFor(outcome)} ${name}`);
  lines.push('');
  lines.push(`**Overall:** \`${outcome}\``);
  lines.push('');
  lines.push('### Steps');
  lines.push('');
  lines.push('| Step | Result |');
  lines.push('|------|--------|');
  lines.push(`| ${iconFor(outcome)} **${name}** | \`${outcome}\` |`);
  lines.push('');
  lines.push('### Trigger');
  if (event !== '') lines.push(`- **event:** \`${event}\``);
  if (ref !== '') lines.push(`- **ref:** \`${ref}\``);
  if (sha !== '') {
    const short = sha.slice(0, 7);
    const commitLink =
      repo !== ''
        ? `[${short}](${server}/${repo}/commit/${sha})`
        : `\`${short}\``;
    lines.push(`- **commit:** ${commitLink}`);
  }
  if (actor !== '') lines.push(`- **actor:** @${actor}`);
  if (secretsEnv !== '') lines.push(`- **SECRETS_ENV:** \`${secretsEnv}\``);
  if (repo !== '' && runId !== '') {
    lines.push(
      `- **workflow run:** [view run](${server}/${repo}/actions/runs/${runId})`
    );
  }
  lines.push('');
  if (outcome === 'failure' && runId !== '') {
    const failureMarkdown = failedTestTraceMarkdown(failedTests, runId);
    if (failureMarkdown !== '') lines.push(failureMarkdown, '');
    else {
      lines.push('### Query traces', '', '```sh');
      lines.push(
        `gh run download ${runId} -n observability-traces-${runId} -D artifacts`
      );
      lines.push('bun obs last --source artifacts --errors --window 24h');
      lines.push('```', '');
    }
  }
  return lines.join('\n');
}

function readFailedTestTraces(): FailedTestTrace[] {
  const failures: FailedTestTrace[] = [];
  for (const tier of ['apps', 'libs', 'pkgs']) {
    if (!existsSync(tier)) continue;
    for (const entry of readdirSync(tier, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = join(
        tier,
        entry.name,
        '.cache/sim-report/traces/spans.ndjson'
      );
      if (existsSync(path)) {
        failures.push(
          ...failedTestTracesFromNdjson(readFileSync(path, 'utf8'))
        );
      }
    }
  }
  return failures;
}

function writeSummary(markdown: string): void {
  const summaryPath = (process.env['GITHUB_STEP_SUMMARY'] ?? '').trim();
  if (summaryPath === '') {
    console.log(markdown);
    return;
  }
  appendFileSync(summaryPath, markdown, 'utf8');
}

try {
  const name = (process.env['WORKFLOW_JOB'] ?? '').trim() || 'job';
  const outcome =
    (process.env['WORKFLOW_OUTCOME'] ?? 'unknown').trim() || 'unknown';
  const status = buildStatusMarkdown(name, outcome, readFailedTestTraces());

  writeSummary(status);
  console.log(`write-workflow-summary: wrote ${outcome} summary`);
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`write-workflow-summary: ${msg}`);
  // Best-effort — never fail the job solely because the summary writer broke.
  process.exit(0);
}

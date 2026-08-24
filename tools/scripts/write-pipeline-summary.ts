#!/usr/bin/env bun
/**
 * Always-run CI helper: append a Deployment Pipeline status block (and, on
 * failure, a copy-pasteable LLM fix prompt) to `GITHUB_STEP_SUMMARY`.
 *
 * Expects:
 * - `DEPLOY_OUTCOME` — `success` | `failure` | `cancelled` | `skipped`
 * - `DEPLOY_LOG_PATH` — path to teed `bun run deploy` output (optional)
 */
// @io-wall-ok — CI entry; reads teed deploy log + writes GITHUB_STEP_SUMMARY
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { buildCiDeployFailureLlmFixPromptMarkdown } from '../../libs/secrets/src/shared/build-llm-fix-prompt';

const MAX_LOG_CHARS = 120_000;

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

function readDeployLog(): string {
  const path = (process.env['DEPLOY_LOG_PATH'] ?? '').trim();
  if (path === '' || !existsSync(path)) {
    return '(no deploy log captured — DEPLOY_LOG_PATH missing or empty)';
  }
  const raw = readFileSync(path, 'utf8');
  if (raw.trim() === '') {
    return '(deploy log was empty — task may have failed before writing output)';
  }
  if (raw.length <= MAX_LOG_CHARS) return raw;
  const head = Math.floor(MAX_LOG_CHARS * 0.15);
  const tail = MAX_LOG_CHARS - head;
  return `${raw.slice(0, head)}\n\n... (truncated ${String(raw.length - MAX_LOG_CHARS)} chars) ...\n\n${raw.slice(-tail)}`;
}

function buildStatusMarkdown(outcome: string): string {
  const lines: string[] = [];
  const repo = (process.env['GITHUB_REPOSITORY'] ?? '').trim();
  const runId = (process.env['GITHUB_RUN_ID'] ?? '').trim();
  const server = (process.env['GITHUB_SERVER_URL'] ?? 'https://github.com').trim();
  const sha = (process.env['GITHUB_SHA'] ?? '').trim();
  const ref = (process.env['GITHUB_REF_NAME'] ?? '').trim();
  const event = (process.env['GITHUB_EVENT_NAME'] ?? '').trim();
  const actor = (process.env['GITHUB_ACTOR'] ?? '').trim();
  const secretsEnv = (process.env['SECRETS_ENV'] ?? '').trim();

  lines.push(`## ${iconFor(outcome)} Deployment Pipeline`);
  lines.push('');
  lines.push(`**Overall:** \`${outcome}\``);
  lines.push('');
  lines.push('### Steps');
  lines.push('');
  lines.push('| Step | Result |');
  lines.push('|------|--------|');
  lines.push(`| ${iconFor(outcome)} **Deploy** | \`${outcome}\` |`);
  lines.push('');
  lines.push('### Trigger');
  if (event !== '') lines.push(`- **event:** \`${event}\``);
  if (ref !== '') lines.push(`- **ref:** \`${ref}\``);
  if (sha !== '') {
    const short = sha.slice(0, 7);
    const commitLink =
      repo !== '' ? `[${short}](${server}/${repo}/commit/${sha})` : `\`${short}\``;
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
  return lines.join('\n');
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
  const outcome = (process.env['DEPLOY_OUTCOME'] ?? 'unknown').trim() || 'unknown';
  const status = buildStatusMarkdown(outcome);

  let llm = '';
  if (outcome === 'failure') {
    llm = buildCiDeployFailureLlmFixPromptMarkdown([
      {
        stepId: 'Deploy — bun run deploy',
        output: readDeployLog(),
      },
    ]);
  }

  writeSummary(llm === '' ? status : `${llm}\n${status}`);
  console.log(
    `write-pipeline-summary: wrote ${outcome} summary` +
      (llm === '' ? '' : ' + LLM fix prompt')
  );
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`write-pipeline-summary: ${msg}`);
  // Best-effort — never fail the job solely because the summary writer broke.
  process.exit(0);
}

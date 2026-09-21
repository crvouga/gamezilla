#!/usr/bin/env bun
/**
 * Always-run CI helper: append a pipeline status block (and, on failure, a
 * copy-pasteable LLM fix prompt) to `GITHUB_STEP_SUMMARY`.
 *
 * Expects:
 * - `PIPELINE_NAME` — step label, e.g. `check` / `deploy:dev`
 * - `PIPELINE_OUTCOME` — `success` | `failure` | `cancelled` | `skipped`
 * - `PIPELINE_LOG_PATH` — path to the teed step output (optional)
 */
// @io-wall-ok — CI entry; reads teed pipeline log + writes GITHUB_STEP_SUMMARY
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { stripVTControlCharacters } from 'node:util';
import { buildCiDeployFailureLlmFixPromptMarkdown } from '@libs/secrets/shared/build-llm-fix-prompt';

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

function readPipelineLog(): string {
  const path = (process.env['PIPELINE_LOG_PATH'] ?? '').trim();
  if (path === '' || !existsSync(path)) {
    return '(no log captured — PIPELINE_LOG_PATH missing or empty)';
  }
  const raw = stripVTControlCharacters(readFileSync(path, 'utf8'));
  if (raw.trim() === '') {
    return '(log was empty — task may have failed before writing output)';
  }
  if (raw.length <= MAX_LOG_CHARS) return raw;
  const head = Math.floor(MAX_LOG_CHARS * 0.15);
  const tail = MAX_LOG_CHARS - head;
  return `${raw.slice(0, head)}\n\n... (truncated ${String(raw.length - MAX_LOG_CHARS)} chars) ...\n\n${raw.slice(-tail)}`;
}

function buildStatusMarkdown(name: string, outcome: string): string {
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
  const name = (process.env['PIPELINE_NAME'] ?? '').trim() || 'pipeline';
  const outcome =
    (process.env['PIPELINE_OUTCOME'] ?? 'unknown').trim() || 'unknown';
  const status = buildStatusMarkdown(name, outcome);

  let llm = '';
  if (outcome === 'failure') {
    llm = buildCiDeployFailureLlmFixPromptMarkdown([
      {
        stepId: name,
        output: readPipelineLog(),
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

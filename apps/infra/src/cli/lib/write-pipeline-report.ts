import { appendFileSync, readFileSync } from 'node:fs';
import { buildLlmFixPromptMarkdown } from './build-llm-fix-prompt';
import { buildVendorDashboardMarkdown } from './dashboard-links';
import type { NeedState } from './pipeline-needs';

/** Stable display order for known jobs; unknown ids sort after, alphabetically. */
const KNOWN_JOB_ORDER: readonly string[] = [
  'format',
  'tc',
  'lint',
  'test',
  'build',
  'i18n',
  'syncpack',
  'knip',
  'depcruise',
  'actionlint',
  'gitleaks',
  'audit',
  'qa-api',
  'qa-browser',
  'publish-playwright-report',
  'deploy',
];

function sortJobIds(ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const ia = KNOWN_JOB_ORDER.indexOf(a);
    const ib = KNOWN_JOB_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

function tableCell(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

function iconForResult(result: string): string {
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

function overallStatus(needs: Readonly<Record<string, NeedState>>): string {
  const results = Object.values(needs).map((n) => n.result);
  if (results.some((r) => r === 'failure')) return 'failure';
  if (results.some((r) => r === 'cancelled')) return 'cancelled';
  return 'success';
}

function iconOverall(overall: string): string {
  switch (overall) {
    case 'success':
      return '✅';
    case 'failure':
      return '❌';
    case 'cancelled':
      return '⚠️';
    default:
      return '❔';
  }
}

export function parseNeedsJson(
  raw: string | undefined
): Record<string, NeedState> {
  if (raw === undefined || raw.trim() === '') {
    throw new Error(
      'NEEDS_JSON is required (e.g. env NEEDS_JSON: ${{ toJSON(needs) }} in GitHub Actions)'
    );
  }
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('NEEDS_JSON must be a JSON object');
  }
  const out: Record<string, NeedState> = {};
  for (const [jobId, entry] of Object.entries(parsed)) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      continue;
    }
    const e = entry as Record<string, unknown>;
    const result = typeof e['result'] === 'string' ? e['result'] : 'unknown';
    let outputs: Record<string, string> | undefined;
    const rawOut = e['outputs'];
    if (
      typeof rawOut === 'object' &&
      rawOut !== null &&
      !Array.isArray(rawOut)
    ) {
      outputs = {};
      for (const [k, v] of Object.entries(rawOut)) {
        if (typeof v === 'string') outputs[k] = v;
        else if (v !== undefined && v !== null) outputs[k] = String(v);
      }
    }
    out[jobId] = outputs !== undefined ? { result, outputs } : { result };
  }
  return out;
}

function readPrUrlFromEvent(): string {
  const path = process.env['GITHUB_EVENT_PATH'];
  if (path === undefined || path.trim() === '') return '';
  try {
    const raw = readFileSync(path, 'utf8');
    const ev = JSON.parse(raw) as {
      pull_request?: { html_url?: string };
    };
    const url = ev.pull_request?.html_url;
    return typeof url === 'string' ? url : '';
  } catch {
    return '';
  }
}

function hasNonEmptyDeployOutputs(
  outputs: Readonly<Record<string, string>>
): boolean {
  return Object.values(outputs).some((v) => (v ?? '').trim() !== '');
}

/** Any job that published `page_url` (Playwright report on Pages); job id is not hardcoded. */
function findPlaywrightPageUrl(
  needs: Readonly<Record<string, NeedState>>
): string {
  for (const state of Object.values(needs)) {
    if (state.result !== 'success') continue;
    const url = state.outputs?.['page_url']?.trim() ?? '';
    if (url !== '') return url;
  }
  return '';
}

/** Builds markdown for the GitHub Actions pipeline summary. */
export function buildPipelineReportMarkdown(
  needs: Readonly<Record<string, NeedState>>
): string {
  const lines: string[] = [];
  const overall = overallStatus(needs);

  lines.push(`## ${iconOverall(overall)} Deployment Pipeline`);
  lines.push('');
  lines.push(`**Overall:** \`${overall}\``);
  lines.push('');
  lines.push('### Jobs');
  lines.push('');
  lines.push('| Job | Result |');
  lines.push('|-----|--------|');
  for (const jobId of sortJobIds(Object.keys(needs))) {
    const r = needs[jobId]?.result ?? 'unknown';
    lines.push(
      `| ${iconForResult(r)} **${tableCell(jobId)}** | \`${tableCell(r)}\` |`
    );
  }
  lines.push('');

  const deploy = needs['deploy'];
  const deployOutputs = deploy?.outputs;
  if (
    deploy?.result === 'success' &&
    deployOutputs !== undefined &&
    hasNonEmptyDeployOutputs(deployOutputs)
  ) {
    lines.push('### Deploy outputs');
    lines.push('');
    lines.push('| Key | Value |');
    lines.push('|-----|-------|');
    for (const [k, v] of Object.entries(deployOutputs).sort(([a], [b]) =>
      a.localeCompare(b)
    )) {
      lines.push(`| **${tableCell(k)}** | ${tableCell(v)} |`);
    }
    lines.push('');
  }

  const ns = deployOutputs?.['cloudflare_nameservers']?.trim() ?? '';
  if (ns !== '') {
    lines.push('### Squarespace Nameserver Setup (one-time)');
    lines.push('');
    lines.push(
      'Point your domain to Cloudflare in [Squarespace Domains](https://domains.squarespace.com):'
    );
    lines.push('');
    lines.push(`**Nameservers:** \`${tableCell(ns)}\``);
    lines.push('');
    lines.push(
      '> DNS records and the apex-to-www redirect are managed by the infra CLI.'
    );
    lines.push(
      '> Once nameservers are delegated, no further Squarespace configuration is needed.'
    );
    lines.push('');
  }

  const pageUrl = findPlaywrightPageUrl(needs);
  if (pageUrl !== '') {
    lines.push('### Playwright report (GitHub Pages)');
    lines.push('');
    lines.push(`[Open report](${pageUrl})`);
    lines.push('');
  }

  lines.push(...buildVendorDashboardMarkdown());

  const repo = process.env['GITHUB_REPOSITORY'] ?? '';
  const server = process.env['GITHUB_SERVER_URL'] ?? 'https://github.com';
  const runId = process.env['GITHUB_RUN_ID'] ?? '';
  const sha = process.env['GITHUB_SHA'] ?? '';
  const ref = process.env['GITHUB_REF_NAME'] ?? '';
  const event = process.env['GITHUB_EVENT_NAME'] ?? '';
  const actor = process.env['GITHUB_ACTOR'] ?? '';

  lines.push('### Trigger');
  lines.push(`- **event:** \`${tableCell(event)}\``);
  lines.push(`- **ref:** \`${tableCell(ref)}\``);
  if (sha !== '') {
    const short = sha.slice(0, 7);
    lines.push(`- **commit:** [\`${short}\`](${server}/${repo}/commit/${sha})`);
  }
  lines.push(`- **actor:** @${tableCell(actor)}`);
  if (repo !== '' && runId !== '') {
    lines.push(
      `- **workflow run:** [view run](${server}/${repo}/actions/runs/${runId})`
    );
  }
  const prUrl = readPrUrlFromEvent();
  if (prUrl !== '') {
    lines.push(`- **PR:** ${prUrl}`);
  }

  return `${lines.join('\n')}\n`;
}

/**
 * Reads `NEEDS_JSON`, builds the report, appends to `GITHUB_STEP_SUMMARY` when
 * set; otherwise prints to stdout (local runs). When any job in `needs`
 * failed, also prepends an aggregated LLM fix prompt that includes the failing
 * step's logs (best-effort; requires `GITHUB_TOKEN` with `actions: read` and
 * the standard `GITHUB_REPOSITORY` / `GITHUB_RUN_ID` env vars provided by the
 * runner). The prompt is placed first so failures are immediately actionable
 * without scrolling past the per-job table.
 */
export async function writePipelineReportToSummary(): Promise<void> {
  const needs = parseNeedsJson(process.env['NEEDS_JSON']);
  const md = buildPipelineReportMarkdown(needs);

  let llmPrompt = '';
  try {
    llmPrompt = await buildLlmFixPromptMarkdown(needs);
  } catch (e) {
    // The prompt is a nice-to-have; never fail the pipeline-report step on it.
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[pipeline-report] LLM fix prompt unavailable: ${msg}`);
  }

  const out = llmPrompt === '' ? md : `${llmPrompt}\n${md}`;
  const summaryPath = process.env['GITHUB_STEP_SUMMARY'] ?? '';
  if (summaryPath === '') {
    console.log(out);
    return;
  }
  appendFileSync(summaryPath, out, 'utf8');
}

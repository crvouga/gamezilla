import { PROJECT_CONFIG } from '../../project-config';
import { PIPELINE_REPORT_USER_AGENT } from '../constants';
import type { NeedState } from './pipeline-needs';

/**
 * Builds a copy-pasteable LLM prompt that aggregates the failing-step logs of
 * every failed job in the current GitHub Actions run. Designed to be appended
 * to the workflow's `GITHUB_STEP_SUMMARY` so a maintainer can paste the prompt
 * straight into an LLM and ask it to fix all failures in one shot.
 *
 * Best-effort: if the GitHub API is unreachable or the token lacks `actions:
 * read`, we degrade to a prompt that just lists failed job ids.
 */

interface RunJob {
  readonly id: number;
  readonly name: string;
  readonly conclusion: string | null;
}

interface ListJobsResponse {
  readonly jobs: ReadonlyArray<RunJob>;
}

interface PromptCtx {
  readonly repo: string;
  readonly runId: string;
  readonly serverUrl: string;
  readonly sha: string;
  readonly ref: string;
  readonly token: string;
}

const MAX_LINES_PER_BLOCK = 200;
const HEAD_LINES_KEPT = 5;

function readCtx(): PromptCtx | undefined {
  const repo = (process.env['GITHUB_REPOSITORY'] ?? '').trim();
  const runId = (process.env['GITHUB_RUN_ID'] ?? '').trim();
  const token = (process.env['GITHUB_TOKEN'] ?? '').trim();
  if (repo === '' || runId === '' || token === '') return undefined;
  return {
    repo,
    runId,
    token,
    serverUrl: (
      process.env['GITHUB_SERVER_URL'] ?? 'https://github.com'
    ).trim(),
    sha: (process.env['GITHUB_SHA'] ?? '').trim(),
    ref: (process.env['GITHUB_REF_NAME'] ?? '').trim(),
  };
}

async function fetchAllRunJobs(ctx: PromptCtx): Promise<RunJob[]> {
  const out: RunJob[] = [];
  const perPage = 100;
  for (let page = 1; page < 50; page++) {
    const url = `https://api.github.com/repos/${ctx.repo}/actions/runs/${ctx.runId}/jobs?per_page=${String(perPage)}&page=${String(page)}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${ctx.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': PIPELINE_REPORT_USER_AGENT,
      },
    });
    if (!res.ok) {
      throw new Error(`GET ${url} -> ${String(res.status)} ${res.statusText}`);
    }
    const data = (await res.json()) as ListJobsResponse;
    out.push(...data.jobs);
    if (data.jobs.length < perPage) break;
  }
  return out;
}

async function fetchJobLog(ctx: PromptCtx, jobId: number): Promise<string> {
  const url = `https://api.github.com/repos/${ctx.repo}/actions/jobs/${String(jobId)}/logs`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': PIPELINE_REPORT_USER_AGENT,
    },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`GET ${url} -> ${String(res.status)} ${res.statusText}`);
  }
  return res.text();
}

function stripAnsi(line: string): string {
  // Strip ANSI escape sequences (CSI and OSC). Logs are colored; the LLM
  // doesn't need the colors and they pollute fenced code blocks.
  return line
    .replace(/\u001b\[[0-9;]*[A-Za-z]/g, '')
    .replace(/\u001b\][^\u0007]*\u0007/g, '');
}

function stripTimestamp(line: string): string {
  return line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s?/, '');
}

function cleanLine(line: string): string {
  return stripAnsi(stripTimestamp(line));
}

/**
 * GitHub Actions logs are organized into step blocks. Each step starts with a
 * `##[group]Run <command>` line and a step that fails ends with an
 * `##[error]Process completed with exit code N.` line. We extract the block
 * from each `##[group]Run` start through (and including) the matching
 * `##[error]Process completed` line, dropping the post-job cleanup output
 * that the runner appends after a failed step.
 */
export function extractFailedStepBlocks(rawLog: string): string[] {
  const lines = rawLog.split(/\r?\n/);
  const stepStarts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const stripped = cleanLine(lines[i] ?? '');
    if (stripped.startsWith('##[group]Run ')) stepStarts.push(i);
  }
  const blocks: string[] = [];
  for (let i = 0; i < stepStarts.length; i++) {
    const start = stepStarts[i] ?? 0;
    const stepEnd = stepStarts[i + 1] ?? lines.length;
    let errorIdx = -1;
    for (let j = start; j < stepEnd; j++) {
      if (cleanLine(lines[j] ?? '').startsWith('##[error]Process completed')) {
        errorIdx = j;
        break;
      }
    }
    if (errorIdx === -1) continue;
    const block = lines.slice(start, errorIdx + 1);
    blocks.push(block.map(cleanLine).join('\n').trimEnd());
  }
  if (blocks.length === 0) {
    // No grouped step boundary found (unusual). Fall back to the tail of the
    // log, which almost always contains the actual error message.
    const tail = lines.slice(-MAX_LINES_PER_BLOCK).map(cleanLine).join('\n');
    blocks.push(tail.trimEnd());
  }
  return blocks;
}

function trimBlock(block: string): string {
  const lines = block.split('\n');
  if (lines.length <= MAX_LINES_PER_BLOCK) return block;
  const head = lines.slice(0, HEAD_LINES_KEPT);
  const tailCount = MAX_LINES_PER_BLOCK - HEAD_LINES_KEPT;
  const tail = lines.slice(-tailCount);
  const omitted = lines.length - HEAD_LINES_KEPT - tailCount;
  return [
    ...head,
    `... (truncated ${String(omitted)} lines; showing first ${String(HEAD_LINES_KEPT)} and last ${String(tailCount)}) ...`,
    ...tail,
  ].join('\n');
}

function cleanEntireLog(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => cleanLine(line))
    .join('\n');
}

interface LocalPromptOptions {
  readonly title: string;
  readonly failureIntro: string;
  readonly fixInstructions: string;
  readonly constraints?: ReadonlyArray<string>;
}

const LOCAL_CHECK_CONSTRAINTS = [
  'Never patch dependencies (`bun patch`, `patch-package`, `patches/`, etc.).',
  'Never disable Tiger-style size-limit ESLint rules (`max-lines`, `max-lines-per-function`, etc.). Refactor instead.',
  'Fix the root cause; do not suppress rules or add blanket biome-ignore comments.',
  'Do not create git commits unless explicitly asked.',
  'After edits, re-run the failing step(s) to verify before finishing.',
] as const;

const DEPLOYMENT_PIPELINE_LOCAL_PROMPT: LocalPromptOptions = {
  title: `Fix local pipeline failures for ${PROJECT_CONFIG.domain}`,
  failureIntro:
    'The Deployment Pipeline checks failed when run locally via `bun run check`.',
  fixInstructions:
    'For each failing job below, identify the root cause from the captured output and fix it — do not just suppress the rule. After fixing, re-run `bun run check` or the matching `bun run <script>` from the repo root `package.json` (e.g. `bun run check:ci`, `bun run check:static`, `bun run check:api`, `bun run check:browser`).',
  constraints: LOCAL_CHECK_CONSTRAINTS,
};

/** Prompt body for local `bun check` failures (offline Turbo graph). */
const LOCAL_BUN_CHECK_PROMPT: LocalPromptOptions = {
  title: `Fix \`bun check\` failures for ${PROJECT_CONFIG.domain}`,
  failureIntro:
    'The `bun check` gates failed (offline Turbo graph: gates/verify/static/secrets + build). An agent should fix every failing step below in one pass.',
  fixInstructions:
    'For each failing step below, identify the root cause from the captured output and fix it — do not just suppress the rule. Prefer fixing all failures together when they share a root cause. After fixing, re-run `bun run check` or the matching step from the repo root `package.json` (e.g. `bun run check:static`, `bun run check:ci:verify`). Live `check:api` / `check:browser` are opt-in / CI-only.',
  constraints: LOCAL_CHECK_CONSTRAINTS,
};

const CHECK_HEAL_LOCAL_PROMPT: LocalPromptOptions = {
  ...LOCAL_BUN_CHECK_PROMPT,
  failureIntro:
    'The deploy-gate checks failed when run locally via `bun run check:heal` (includes live `check:api` / `check:browser`).',
  fixInstructions:
    'For each failing step below, identify the root cause from the captured output and fix it — do not just suppress the rule. Prefer fixing all failures together when they share a root cause. After fixing, re-run `bun run check:heal` or the matching step from the repo root `package.json` (e.g. `bun run check:static`, `bun run check:ci:verify`, `bun run check:api`, `bun run check:browser`).',
};

function renderLocalPromptBody(
  failures: ReadonlyArray<{ readonly jobId: string; readonly output: string }>,
  options: LocalPromptOptions
): string {
  const lines: string[] = [];
  lines.push(`# ${options.title}`);
  lines.push('');
  lines.push(options.failureIntro);
  lines.push('');
  lines.push(options.fixInstructions);
  if (options.constraints !== undefined && options.constraints.length > 0) {
    lines.push('');
    lines.push('Constraints:');
    for (const c of options.constraints) {
      lines.push(`- ${c}`);
    }
  }
  lines.push('');
  for (const f of failures) {
    lines.push(`## \`${f.jobId}\``);
    lines.push('');
    lines.push('```text');
    lines.push(trimBlock(cleanEntireLog(f.output).trimEnd()));
    lines.push('```');
    lines.push('');
  }
  return lines.join('\n').trimEnd();
}

interface FailureSection {
  readonly jobId: string;
  readonly snippets: ReadonlyArray<string>;
  readonly note?: string;
}

function renderPromptBody(
  ctx: PromptCtx,
  sections: ReadonlyArray<FailureSection>
): string {
  const lines: string[] = [];
  lines.push(`# Fix CI failures for ${PROJECT_CONFIG.domain}`);
  lines.push('');
  lines.push(
    `Workflow run: ${ctx.serverUrl}/${ctx.repo}/actions/runs/${ctx.runId}`
  );
  if (ctx.sha !== '') {
    const short = ctx.sha.slice(0, 7);
    lines.push(`Commit: \`${short}\` on \`${ctx.ref}\``);
  }
  lines.push('');
  lines.push(
    `The Deployment Pipeline failed on ${String(sections.length)} job(s). For each job, identify the root cause from the logs below and fix it -- do not just suppress the rule. After fixing, run the matching \`bun run ...\` command locally to verify (e.g. \`bun run check:ci\`, \`bun run check:static\`, \`bun run check:api\`, \`bun run check:browser\`, \`bun run ci:depcruise\`, \`bun run ci:syncpack\`).`
  );
  lines.push('');
  for (const s of sections) {
    lines.push(`## \`${s.jobId}\``);
    lines.push('');
    if (s.note !== undefined && s.note !== '') {
      lines.push(`> ${s.note}`);
      lines.push('');
    }
    for (const snippet of s.snippets) {
      lines.push('```text');
      lines.push(trimBlock(snippet));
      lines.push('```');
      lines.push('');
    }
  }
  return lines.join('\n').trimEnd();
}

/**
 * Wraps the body in a collapsed `<details>` block so the report summary stays
 * readable when there are many failures. The body is fenced with FOUR
 * backticks so the inner three-backtick code blocks render correctly when the
 * user copies the contents into an LLM.
 */
function renderMarkdownSection(
  body: string,
  expandSummary = 'Click to expand. Copy the entire fenced block into an LLM to fix all CI failures.'
): string {
  const lines: string[] = [];
  lines.push('### LLM fix prompt');
  lines.push('');
  lines.push('<details>');
  lines.push(`<summary>${expandSummary}</summary>`);
  lines.push('');
  lines.push('````markdown');
  lines.push(body);
  lines.push('````');
  lines.push('');
  lines.push('</details>');
  lines.push('');
  return lines.join('\n');
}

export async function buildLlmFixPromptMarkdown(
  needs: Readonly<Record<string, NeedState>>
): Promise<string> {
  const failed = Object.entries(needs).filter(
    ([, n]) => n.result === 'failure'
  );
  if (failed.length === 0) return '';

  const ctx = readCtx();
  if (ctx === undefined) {
    // Local invocation, or workflow that didn't pass GITHUB_TOKEN. Render a
    // bare-bones prompt with just the job ids -- still useful as a checklist.
    const sections: FailureSection[] = failed.map(([jobId]) => ({
      jobId,
      snippets: [],
      note: 'No log available (GITHUB_TOKEN / GITHUB_REPOSITORY / GITHUB_RUN_ID unset).',
    }));
    return renderMarkdownSection(
      renderPromptBody(
        {
          repo: '',
          runId: '',
          serverUrl: 'https://github.com',
          sha: '',
          ref: '',
          token: '',
        },
        sections
      )
    );
  }

  let jobs: RunJob[];
  try {
    jobs = await fetchAllRunJobs(ctx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const sections: FailureSection[] = failed.map(([jobId]) => ({
      jobId,
      snippets: [],
      note: `Could not list run jobs: ${msg}`,
    }));
    return renderMarkdownSection(renderPromptBody(ctx, sections));
  }

  const sections: FailureSection[] = [];
  for (const [jobId] of failed) {
    const job = jobs.find((j) => j.name === jobId);
    if (job === undefined) {
      sections.push({
        jobId,
        snippets: [],
        note: 'No matching job found in run; logs unavailable.',
      });
      continue;
    }
    let log: string;
    try {
      log = await fetchJobLog(ctx, job.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      sections.push({
        jobId,
        snippets: [],
        note: `Could not fetch logs: ${msg}`,
      });
      continue;
    }
    const blocks = extractFailedStepBlocks(log);
    sections.push({ jobId, snippets: blocks });
  }

  return renderMarkdownSection(renderPromptBody(ctx, sections));
}

/**
 * Same collapsed markdown wrapper as CI (`renderMarkdownSection`), but body
 * is built from locally captured command output instead of the GitHub API.
 */
export function buildLocalLlmFixPromptMarkdown(
  failures: ReadonlyArray<{ readonly jobId: string; readonly output: string }>
): string {
  if (failures.length === 0) return '';
  return renderMarkdownSection(
    renderLocalPromptBody(failures, DEPLOYMENT_PIPELINE_LOCAL_PROMPT),
    'Click to expand. Copy the entire fenced block into an LLM to fix all local pipeline failures.'
  );
}

/**
 * Plain-text prompt body for local check / heal step failures (used by
 * `check:heal` and `run-deployment-pipeline-checks`).
 */
export function buildLocalCheckFixPromptBody(
  failures: ReadonlyArray<{ readonly stepId: string; readonly output: string }>
): string {
  if (failures.length === 0) return '';
  const mapped = failures.map((f) => ({
    jobId: f.stepId,
    output: f.output,
  }));
  return renderLocalPromptBody(mapped, LOCAL_BUN_CHECK_PROMPT);
}

/** Plain-text prompt body for the `check:heal` agent loop (no markdown wrapper). */
export function buildCheckHealPromptBody(
  failures: ReadonlyArray<{ readonly stepId: string; readonly output: string }>
): string {
  if (failures.length === 0) return '';
  const mapped = failures.map((f) => ({
    jobId: f.stepId,
    output: f.output,
  }));
  return renderLocalPromptBody(mapped, CHECK_HEAL_LOCAL_PROMPT);
}

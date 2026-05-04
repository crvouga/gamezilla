import type { NeedState } from './write-pipeline-report';

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
        'User-Agent': 'gamezilla-pipeline-report',
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
      'User-Agent': 'gamezilla-pipeline-report',
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
  lines.push('# Fix CI failures for gamezilla.app');
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
    `The Deployment Pipeline failed on ${String(sections.length)} job(s). For each job, identify the root cause from the logs below and fix it -- do not just suppress the rule. After fixing, run the matching \`bun run ...\` command locally to verify (e.g. \`bun run format:check\`, \`bun run knip:ci\`, \`bun run depcruise:ci\`, \`bun run syncpack:lint\`, \`bun run qa:api\`, \`bun run qa:browser\`).`
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
function renderMarkdownSection(body: string): string {
  const lines: string[] = [];
  lines.push('### LLM fix prompt');
  lines.push('');
  lines.push('<details>');
  lines.push(
    '<summary>Click to expand. Copy the entire fenced block into an LLM to fix all CI failures.</summary>'
  );
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

#!/usr/bin/env bun
// @io-wall-ok — tools composition root
/**
 * Strict PR contract enforcement: the PR body must fill every section of
 * `.github/pull_request_template.md` and check every box in its checklist.
 *
 * The body comes from the `pull_request` event payload in Actions
 * (`GITHUB_EVENT_PATH`) or, locally, from `gh pr view` for the current branch.
 * No PR context (no event, no `gh`, no PR yet) skips with a notice — the gate
 * is PR CI, where the payload is always present.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Required `##` sections — must exist and carry content of their own. */
export const REQUIRED_SECTIONS = [
  'Summary',
  'Why',
  'Scope',
  'Verification',
  'Risk',
  'Provenance',
  'Checklist',
] as const;

/**
 * Required checklist lines, verbatim from the template. Kept here so deleting
 * a line cannot satisfy the gate. `check-pr-body.test.ts` asserts the template
 * still contains each of them.
 */
export const CHECKLIST_ITEMS = [
  'CI (`bun check`) is green on this PR.',
  'Every touched package ran `bun run --filter <pkg> tc` and `test` locally.',
  'No check was weakened: no deleted or skipped tests, no loosened assertion, no `@ts-ignore`, no disabled lint rule.',
  'Changed behavior is covered by a test, or Verification states why it cannot be.',
  'No deprecated code left behind: replaced APIs are deleted and every call site migrated here.',
  'Nondeterministic I/O stays injected (Clock/Timers/http/createId/random); no bare `Date.now`, `setTimeout`, `fetch`, or `crypto.randomUUID` in product code.',
  'Schema changes use `defineTable` + a registered migration; no raw `CREATE TABLE` and no new `.sql` schema files.',
  'Domain removals are soft deletes (`deleted_at`); no `DELETE FROM` on domain tables.',
  'Client reads/writes go through local SQLite queries and mutations; no new data REST endpoint.',
  'Any new secret is registered in `@libs/secrets` and provisioned for dev and prd.',
  'Docs updated wherever behavior, conventions, or operations changed.',
  'No long-running local process still holds a machine-wide singleton port (EMQX `1883`/`8083`/`18083`, e2e `4177`/`4178`, wrangler `8788`).',
  'A human merges this PR — agents never merge (`gh pr merge`, auto-merge, merge queue).',
] as const;

const TITLE_PATTERN =
  /^(feat|fix|refactor|test|chore|docs|perf|ci)(\([a-z0-9./-]+\))?!?: \S.*$/;
const TITLE_MAX_LENGTH = 72;
const SECTION_HEADING = /^## .+$/;
const UNCHECKED_BOX = /^\s*[-*] \[ \] /;

type PullRequestBody = {
  readonly title: string;
  readonly body: string;
};

/** Drops HTML comments so template guidance never counts as content. */
function stripHtmlComments(text: string): string {
  return text.replaceAll(/<!--[\s\S]*?-->/g, '');
}

/** Content of `## <name>`, or `null` when the section is absent. */
function sectionContent(body: string, name: string): string | null {
  const lines = body.split('\n');
  const heading = `## ${name}`;
  const start = lines.findIndex((line) => line.trim() === heading);
  if (start === -1) return null;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => SECTION_HEADING.test(line.trim()));
  return (end === -1 ? rest : rest.slice(0, end)).join('\n');
}

/** Every reason this PR does not satisfy the contract. */
export function validatePullRequest(
  pullRequest: PullRequestBody
): readonly string[] {
  const violations: string[] = [];
  const title = pullRequest.title.trim();

  if (title.length === 0) {
    violations.push('PR title is empty.');
  } else if (!TITLE_PATTERN.test(title)) {
    violations.push(
      'PR title must be Conventional Commits: `<type>(<scope>): <summary>` with type feat|fix|refactor|test|chore|docs|perf|ci.'
    );
  } else if (title.length > TITLE_MAX_LENGTH) {
    violations.push(
      `PR title is ${String(title.length)} chars; the limit is ${String(TITLE_MAX_LENGTH)}.`
    );
  }

  const body = stripHtmlComments(pullRequest.body);
  for (const name of REQUIRED_SECTIONS) {
    const content = sectionContent(body, name);
    if (content === null) {
      violations.push(`Missing required section: \`## ${name}\`.`);
      continue;
    }
    if (content.trim().length === 0) {
      violations.push(`Section \`## ${name}\` is empty.`);
    }
  }

  const checklist = sectionContent(body, 'Checklist');
  if (checklist !== null) {
    for (const line of checklist.split('\n')) {
      if (UNCHECKED_BOX.test(line)) {
        violations.push(`Unchecked item in \`## Checklist\`: ${line.trim()}`);
      }
    }
    const checked = checklist
      .split('\n')
      .filter((line) => /^\s*[-*] \[[xX]\] /.test(line));
    for (const item of CHECKLIST_ITEMS) {
      if (!checked.some((line) => line.includes(item))) {
        violations.push(`Checklist item is missing or unchecked: "${item}"`);
      }
    }
  }

  return violations;
}

/** PR title + body from the Actions event payload, when running in CI. */
function readFromEventPayload(): PullRequestBody | null {
  const path = process.env['GITHUB_EVENT_PATH'];
  if (path === undefined || path.length === 0) return null;
  try {
    const payload = JSON.parse(readFileSync(path, 'utf8')) as {
      pull_request?: { title?: string; body?: string | null };
    };
    const pullRequest = payload.pull_request;
    if (pullRequest === undefined) return null;
    return {
      title: pullRequest.title ?? '',
      body: pullRequest.body ?? '',
    };
  } catch {
    return null;
  }
}

/** PR title + body for the current branch via `gh`, when a PR exists. */
function readFromGh(): PullRequestBody | null {
  const result = spawnSync(
    'gh',
    ['pr', 'view', '--json', 'title,body', '--jq', '.title, .body'],
    { encoding: 'utf8' }
  );
  if (result.status !== 0 || result.stdout === null) return null;
  const output = result.stdout;
  const separator = output.indexOf('\n');
  if (separator === -1) return null;
  return {
    title: output.slice(0, separator),
    body: output.slice(separator + 1),
  };
}

function report(pullRequest: PullRequestBody): number {
  const violations = validatePullRequest(pullRequest);
  if (violations.length === 0) {
    process.stdout.write(
      '[ci:pr-template] PR body satisfies the template contract.\n'
    );
    return 0;
  }
  process.stderr.write(
    `[ci:pr-template] PR does not satisfy .github/pull_request_template.md:\n` +
      violations.map((violation) => `- ${violation}`).join('\n') +
      '\n'
  );
  return 1;
}

if (import.meta.main) {
  const pullRequest = readFromEventPayload() ?? readFromGh();
  if (pullRequest === null) {
    process.stdout.write(
      '[ci:pr-template] no PR context (no event payload, no PR for this branch); skipping.\n'
    );
    process.exit(0);
  }
  process.exit(report(pullRequest));
}

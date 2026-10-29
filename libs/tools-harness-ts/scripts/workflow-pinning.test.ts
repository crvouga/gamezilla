import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '../../..');

function workflowFiles(): string[] {
  const files = readdirSync(join(ROOT, '.github/workflows')).map((file) =>
    join(ROOT, '.github/workflows', file)
  );
  const actions = join(ROOT, '.github/actions');
  for (const entry of readdirSync(actions, { recursive: true }))
    if (/(^|\/)action\.ya?ml$/.test(String(entry).replaceAll('\\', '/')))
      files.push(join(actions, String(entry)));
  return files;
}

// The repository is public: a moved tag on a third-party action would run new
// code with this repository's OIDC token and secrets. Every action outside
// this repository is pinned to a full commit SHA, with its release as a
// comment so an update is readable (and Dependabot keeps both in step).
test('every action from outside this repository is pinned to a commit SHA', () => {
  const unpinned: string[] = [];
  let external = 0;
  for (const file of workflowFiles())
    for (const match of readFileSync(file, 'utf8').matchAll(
      /^\s*(?:-\s*)?uses:\s*(\S+)(.*)$/gm
    )) {
      const ref = match[1]!;
      if (ref.startsWith('./')) continue;
      external += 1;
      if (!/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(ref))
        unpinned.push(`${file}: ${ref}`);
      else if (!/^\s+# v\d+(\.\d+)*$/.test(match[2] ?? ''))
        unpinned.push(`${file}: ${ref} needs a "# vX.Y.Z" comment`);
    }
  expect(external).toBeGreaterThan(0);
  expect(unpinned).toEqual([]);
});

type Step = { run?: unknown; uses?: string; with?: Record<string, unknown> };

function steps(file: string): Step[] {
  const parsed = Bun.YAML.parse(readFileSync(file, 'utf8')) as {
    jobs?: Record<string, { steps?: Step[] }>;
    runs?: { steps?: Step[] };
  };
  return [
    ...Object.values(parsed.jobs ?? {}).flatMap((job) => job.steps ?? []),
    ...(parsed.runs?.steps ?? []),
  ];
}

// Nothing reaches a step's shell through an expression: a value a step needs
// comes in through `env:`, so no text (a contributor's title, branch name or
// commit message included) is ever spliced into a script.
test('no run step interpolates an expression into its script', () => {
  const offenders: string[] = [];
  for (const file of workflowFiles())
    for (const step of steps(file))
      if (typeof step.run === 'string' && step.run.includes('${{'))
        offenders.push(`${file}: ${step.run.split('\n')[0]}`);
  expect(offenders).toEqual([]);
});

// A trigger that runs with this repository's privileges on behalf of a fork
// (`pull_request_target`, `workflow_run`, comment and review events) would put
// untrusted code next to secrets. Pull requests use `pull_request`, which
// gives a fork no secret and no OIDC token.
test('no workflow has a privileged trigger a fork can start', () => {
  const privileged = [
    'pull_request_target',
    'workflow_run',
    'issue_comment',
    'pull_request_review',
    'pull_request_review_comment',
  ];
  for (const file of readdirSync(join(ROOT, '.github/workflows'))) {
    const workflow = Bun.YAML.parse(
      readFileSync(join(ROOT, '.github/workflows', file), 'utf8')
    ) as { on: Record<string, unknown> };
    for (const trigger of privileged)
      expect(Object.keys(workflow.on), file).not.toContain(trigger);
  }
});

// A checkout that keeps the job token in `.git/config` hands it to every
// later step, including dependency scripts. No job pushes with git.
test('no checkout persists the job token', () => {
  const persisting: string[] = [];
  for (const file of workflowFiles())
    for (const step of steps(file))
      if (
        step.uses?.startsWith('actions/checkout@') &&
        step.with?.['persist-credentials'] !== false
      )
        persisting.push(file);
  expect(persisting).toEqual([]);
});

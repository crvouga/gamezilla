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

// Untrusted pull-request code must never reach a step's shell through an
// expression: event text a contributor controls (titles, bodies, branch
// names, commit messages) is passed through `env:` if a step needs it.
test('no run step interpolates contributor-controlled event text', () => {
  const tainted =
    /\$\{\{\s*github\.(?:event\.(?:pull_request\.(?:title|body|head\.(?:ref|label))|issue\.(?:title|body)|comment\.body|review\.body|head_commit\.(?:message|author)|commits)|head_ref)/;
  const offenders: string[] = [];
  for (const file of workflowFiles()) {
    const parsed = Bun.YAML.parse(readFileSync(file, 'utf8')) as {
      jobs?: Record<string, { steps?: { run?: unknown }[] }>;
      runs?: { steps?: { run?: unknown }[] };
    };
    const steps = [
      ...Object.values(parsed.jobs ?? {}).flatMap((job) => job.steps ?? []),
      ...(parsed.runs?.steps ?? []),
    ];
    for (const step of steps)
      if (typeof step.run === 'string' && tainted.test(step.run))
        offenders.push(`${file}: ${step.run.split('\n')[0]}`);
  }
  expect(offenders).toEqual([]);
});

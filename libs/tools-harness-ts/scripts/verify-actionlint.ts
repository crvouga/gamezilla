#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Lints `.github/workflows/**` (actionlint, which also runs shellcheck on
 * `run:`). Workspace/CI setup installs the tools pinned in `mise.toml`.
 * Resolve the executable explicitly: PATH may shadow it inside `mise exec`.
 */
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../../..');

const workflows = readdirSync(join(REPO_ROOT, '.github/workflows'))
  .filter((file) => /\.ya?ml$/.test(file))
  .map((file) => `.github/workflows/${file}`);
if (workflows.length === 0) throw new Error('No native CI workflows found');
// actionlint 1.7.12 predates GitHub's concurrency.queue. Validate that field
// here before excluding only its exact unknown-key diagnostic below. Remove
// this compatibility check when the pinned actionlint supports queue.
function verifyQueue(concurrency: unknown, location: string): void {
  if (typeof concurrency !== 'object' || concurrency === null) return;
  const settings = concurrency as Record<string, unknown>;
  if (!Object.hasOwn(settings, 'queue')) return;
  if (settings['queue'] !== 'single' && settings['queue'] !== 'max')
    throw new Error(`${location}: concurrency.queue must be single or max`);
  if (
    settings['queue'] === 'max' &&
    settings['cancel-in-progress'] !== undefined &&
    settings['cancel-in-progress'] !== false
  )
    throw new Error(`${location}: queue max requires cancel-in-progress false`);
}

for (const file of workflows) {
  const workflow = Bun.YAML.parse(
    readFileSync(join(REPO_ROOT, file), 'utf8')
  ) as {
    concurrency?: unknown;
    jobs?: Record<string, { concurrency?: unknown }>;
  };
  verifyQueue(workflow.concurrency, file);
  for (const [id, job] of Object.entries(workflow.jobs ?? {}))
    verifyQueue(job.concurrency, `${file}: ${id}`);
}
const QUEUE_DIAGNOSTIC =
  '^unexpected key "queue" for "concurrency" section\\. expected one of "cancel-in-progress", "group"$';

const selected = spawnSync('mise', ['which', 'actionlint'], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
});
if (selected.error !== undefined || selected.status !== 0) {
  console.error(
    `verify:actionlint: cannot resolve the pinned tool: ${selected.error?.message ?? selected.stderr.trim()}`
  );
  process.exit(selected.status ?? 1);
}
const executable = selected.stdout.trim();
if (!isAbsolute(executable)) {
  console.error(
    'verify:actionlint: mise did not select an absolute executable'
  );
  process.exit(1);
}
const result = spawnSync(
  executable,
  [
    '-color',
    '-config-file',
    '.github/actionlint.yaml',
    '-ignore',
    QUEUE_DIAGNOSTIC,
    ...workflows,
  ],
  {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  }
);
if (result.error !== undefined) {
  console.error(
    `verify:actionlint: ${result.error.message} — run mise install`
  );
}
process.exit(result.status ?? 1);

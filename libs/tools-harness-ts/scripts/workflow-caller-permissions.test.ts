import { expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOWS = join(import.meta.dirname, '../../../.github/workflows');
const LOCAL_PREFIX = './.github/workflows/';
const RANK: Record<string, number> = { none: 0, read: 1, write: 2 };

type Permissions = Record<string, string> | string | undefined;
type Job = { uses?: string; permissions?: Permissions };
type Workflow = { permissions?: Permissions; jobs: Record<string, Job> };

function load(file: string): Workflow {
  return Bun.YAML.parse(
    readFileSync(join(WORKFLOWS, file), 'utf8')
  ) as Workflow;
}

/** A job's token scopes: its own block, or the workflow's when it has none. */
function scopes(workflow: Workflow, job: Job): Record<string, string> {
  const declared = job.permissions ?? workflow.permissions ?? {};
  if (typeof declared === 'string') {
    throw new Error(`shorthand permissions (${declared}) are not compared`);
  }
  return declared;
}

/** Every scope a called workflow's job needs that its caller does not grant. */
function shortfalls(): string[] {
  const missing: string[] = [];
  for (const file of readdirSync(WORKFLOWS).filter((f) => f.endsWith('.yml'))) {
    const caller = load(file);
    for (const [jobId, job] of Object.entries(caller.jobs)) {
      if (job.uses?.startsWith(LOCAL_PREFIX) !== true) continue;
      const calledFile = job.uses.slice(LOCAL_PREFIX.length);
      const called = load(calledFile);
      const granted = scopes(caller, job);
      for (const [calledId, calledJob] of Object.entries(called.jobs)) {
        for (const [scope, level] of Object.entries(
          scopes(called, calledJob)
        )) {
          const have = granted[scope] ?? 'none';
          if ((RANK[have] ?? 0) < (RANK[level] ?? 0)) {
            missing.push(
              `${file} ${jobId} grants ${scope}: ${have}, but ${calledFile} ${calledId} needs ${scope}: ${level}`
            );
          }
        }
      }
    }
  }
  return missing;
}

// regression: reusable-workflow-caller-permission-shortfall
test('a workflow grants every scope the workflow it calls asks for', () => {
  // GitHub refuses to start the whole run (startup_failure, no job, no log)
  // when a called job asks for more than its caller's job grants.
  expect(shortfalls()).toEqual([]);
});

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { flattenCheckAggregators } from './turbo-ci-run';

const REPO_ROOT = join(import.meta.dirname, '../../..');

type TaskConfig = {
  readonly dependsOn?: readonly string[];
  readonly cache?: boolean;
  readonly inputs?: readonly string[];
};
type Tasks = Readonly<Record<string, TaskConfig>>;

function loadTasks(): Tasks {
  const turbo = JSON.parse(
    readFileSync(join(REPO_ROOT, 'turbo.json'), 'utf8')
  ) as { tasks: Tasks };
  return turbo.tasks;
}

function loadRootScripts(): Readonly<Record<string, string>> {
  const pkg = JSON.parse(
    readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')
  ) as { scripts: Record<string, string> };
  return pkg.scripts;
}

function turboCiRunTaskArgs(script: string): string[] {
  const marker = 'turbo-ci-run.ts';
  const idx = script.indexOf(marker);
  expect(idx).toBeGreaterThanOrEqual(0);
  return script
    .slice(idx + marker.length)
    .trim()
    .split(/\s+/);
}

/**
 * `//#check` is the whole check surface. Everything a package can check about
 * itself rides in its own `tc` / `lint` / `test` / `test:contract` /
 * `test:e2e`, so it caches per package; root leaves are only the checks whose
 * subject belongs to no package.
 */
const CHECK_LEAVES = [
  '//#lint:root',
  '//#ci:syncpack',
  '//#ci:audit',
  '//#ci:i18n',
  '//#ci:agent-commands',
  '//#ci:goals',
  'tc',
  'lint',
  'test',
  'test:contract',
  'test:e2e',
  '@apps/client#check:bundle-budget',
  '@apps/product#check:offline-shell',
  '@apps/room-server#check:worker-bundle',
  '@apps/server#check:worker-bundle',
  '@libs/runtime#check:schema-evolution',
  '@libs/secrets#check',
  '@libs/tools#check:static',
];

/** Deploy runs the whole check surface, then the leaves that need a live env. */
const DEPLOY_ONLY = ['@apps/server#check:api', '//#smoke'] as const;

/** `//#smoke` flattens to the per-package live-resource probes. */
const SMOKE_LEAVES = ['smoke'] as const;

/** The config turbo applies to `task`: `pkg#name` if defined, else `name`. */
function configFor(tasks: Tasks, task: string): TaskConfig | undefined {
  const bare = task.startsWith('^') ? task.slice(1) : task;
  if (tasks[bare] !== undefined) return tasks[bare];
  const hash = bare.indexOf('#');
  return hash > 0 ? tasks[bare.slice(hash + 1)] : undefined;
}

/** Every task `//#check` can schedule, through `dependsOn` and `^deps`. */
function reachableFromCheck(tasks: Tasks): ReadonlySet<string> {
  const seen = new Set<string>();
  const queue = [...CHECK_LEAVES];
  while (queue.length > 0) {
    const task = queue.pop() ?? '';
    const bare = task.startsWith('^') ? task.slice(1) : task;
    if (seen.has(bare)) continue;
    seen.add(bare);
    queue.push(...(configFor(tasks, bare)?.dependsOn ?? []));
  }
  return seen;
}

describe('turbo check/deploy graph invariants', () => {
  test('//#check is exactly the check surface', () => {
    expect(loadTasks()['//#check']?.dependsOn).toEqual(CHECK_LEAVES);
  });

  test('every task `bun check` can run is cached', () => {
    const tasks = loadTasks();
    const uncached = [...reachableFromCheck(tasks)].filter(
      (task) => configFor(tasks, task)?.cache === false
    );
    expect(uncached).toEqual([]);
  });

  test('package check tasks hash every file in the package', () => {
    // An enumerated input list is how a fixture or a tests/ tsconfig include
    // silently falls out of the hash and a stale pass gets served.
    const tasks = loadTasks();
    for (const task of [
      'tc',
      'lint',
      'test',
      'test:contract',
      'test:e2e',
      'check:worker-bundle',
    ]) {
      expect(tasks[task]?.inputs?.[0], task).toBe('$TURBO_DEFAULT$');
    }
  });

  // goal:the-bar:1 — every check that gates a release also gates a PR merge.
  test('//#deploy is //#check plus the live-env leaves', () => {
    const tasks = loadTasks();
    expect(tasks['//#deploy']?.dependsOn).toEqual(['//#check', ...DEPLOY_ONLY]);
    expect(flattenCheckAggregators(['deploy'], tasks)).toEqual([
      ...CHECK_LEAVES,
      '@apps/server#check:api',
      ...SMOKE_LEAVES,
    ]);
  });

  test('bun check and bun deploy go through turbo-ci-run', () => {
    const scripts = loadRootScripts();
    expect(turboCiRunTaskArgs(scripts['check'] ?? '')).toEqual(['check']);
    expect(turboCiRunTaskArgs(scripts['deploy'] ?? '')).toEqual(['//#deploy']);
    expect(turboCiRunTaskArgs(scripts['smoke'] ?? '')).toEqual(['smoke']);
  });

  test('check flattens to its leaves', () => {
    expect(flattenCheckAggregators(['check'], loadTasks())).toEqual(
      CHECK_LEAVES
    );
  });

  test('//#smoke is exactly the per-package smoke task', () => {
    const tasks = loadTasks();
    expect(tasks['//#smoke']?.dependsOn).toEqual([...SMOKE_LEAVES]);
    expect(flattenCheckAggregators(['smoke'], tasks)).toEqual([
      ...SMOKE_LEAVES,
    ]);
  });

  test('smoke probes live resources: never cached, ordered after the deploy', () => {
    const smoke = loadTasks()['smoke'];
    expect(smoke?.cache).toBe(false);
    expect(smoke?.dependsOn).toContain('@apps/product#deploy');
    expect(smoke?.dependsOn).toContain('@libs/billing#billing:sync');
  });

  test('secrets provision runs after install:cli (avoid infisical race)', () => {
    const deps = loadTasks()['@libs/secrets#provision']?.dependsOn;
    expect(deps).toContain('@libs/tools#install:cli');
  });
});

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
  '@libs/tools#check:static',
];

/** Deploy runs the whole check surface, then the leaves that need a live env. */
const DEPLOY_ONLY = ['@apps/server#check:api', 'health'] as const;

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

/**
 * Cycles among declared root tasks. Inside a root task's `dependsOn`, a bare
 * `name` resolves to `//#name` whenever that root task is declared (the root
 * package runs its own `name` too), and `//#name` names it directly — so a
 * root aggregator that depends on the bare name of itself, or on a root task
 * that leads back to it, is a cycle turbo refuses to plan. Returns each
 * cycle as the path that closes it.
 */
function rootTaskCycles(tasks: Tasks): string[][] {
  const roots = Object.keys(tasks).filter((task) => task.startsWith('//#'));
  const rootDeps = (task: string): string[] =>
    (tasks[task]?.dependsOn ?? []).flatMap((dep) => {
      if (dep.startsWith('^')) return [];
      const id = dep.includes('#') ? dep : `//#${dep}`;
      return tasks[id] !== undefined && id.startsWith('//#') ? [id] : [];
    });
  const cycles: string[][] = [];
  const done = new Set<string>();
  function visit(task: string, path: readonly string[]): void {
    const at = path.indexOf(task);
    if (at >= 0) {
      cycles.push([...path.slice(at), task]);
      return;
    }
    if (done.has(task)) return;
    for (const dep of rootDeps(task)) visit(dep, [...path, task]);
    done.add(task);
  }
  for (const task of roots) visit(task, []);
  return cycles;
}

describe('turbo check/deploy graph invariants', () => {
  test('root-task cycle detection catches a self-dependent aggregator', () => {
    expect(rootTaskCycles({ '//#health': { dependsOn: ['health'] } })).toEqual([
      ['//#health', '//#health'],
    ]);
    expect(
      rootTaskCycles({
        '//#a': { dependsOn: ['//#b'] },
        '//#b': { dependsOn: ['a'] },
      })
    ).toEqual([['//#a', '//#b', '//#a']]);
  });

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
      ...DEPLOY_ONLY,
    ]);
  });

  test('bun check and bun deploy go through turbo-ci-run', () => {
    const scripts = loadRootScripts();
    expect(turboCiRunTaskArgs(scripts['check'] ?? '')).toEqual(['check']);
    expect(turboCiRunTaskArgs(scripts['deploy'] ?? '')).toEqual(['//#deploy']);
    expect(turboCiRunTaskArgs(scripts['health'] ?? '')).toEqual(['health']);
  });

  test('check flattens to its leaves', () => {
    expect(flattenCheckAggregators(['check'], loadTasks())).toEqual(
      CHECK_LEAVES
    );
  });

  test('bun health runs only the per-package health task', () => {
    expect(flattenCheckAggregators(['health'], loadTasks())).toEqual([
      'health',
    ]);
  });

  // regression: deploy-health-self-cycle — `//#health` depended on bare
  // `health`, which the root `health` script resolves back to `//#health`;
  // turbo refused to plan `//#deploy` ("//#health depends on itself").
  test('root tasks form no dependency cycle', () => {
    expect(rootTaskCycles(loadTasks())).toEqual([]);
  });

  test('health probes live resources: never cached, ordered after the deploy', () => {
    const health = loadTasks()['health'];
    expect(health?.cache).toBe(false);
    expect(health?.dependsOn).toContain('@apps/product#deploy');
    expect(health?.dependsOn).toContain('@libs/billing#billing:sync');
  });

  test('secrets provision runs after install:cli (avoid infisical race)', () => {
    const deps = loadTasks()['@libs/secrets#provision']?.dependsOn;
    expect(deps).toContain('@libs/tools#install:cli');
  });
});

import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SECRETS_RANGE_ENV } from './secrets-scan-range';
import { MAX_SPEC_PARTS, specPartProblems } from './spec-packages';
import { flattenCheckAggregators } from './turbo-ci-run';

const REPO_ROOT = join(import.meta.dirname, '../../..');

type TaskConfig = {
  readonly dependsOn?: readonly string[];
  readonly cache?: boolean;
  readonly inputs?: readonly string[];
  readonly outputs?: readonly string[];
  readonly env?: readonly string[];
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

test('spec ownership caches the exact commit range it checks', () => {
  // regression: spec-rulebook-commit-subject
  expect(loadTasks()['//#ci:spec-ownership']?.env).toContain(SECRETS_RANGE_ENV);
});

function turboCiRunTaskArgs(script: string): string[] {
  const marker = 'turbo-ci-run.ts';
  const idx = script.indexOf(marker);
  expect(idx).toBeGreaterThanOrEqual(0);
  return script
    .slice(idx + marker.length)
    .trim()
    .split(/\s+/);
}

/** A suite's parts (`test-spec.ts --part k/n`); see `specPartProblems`. */
const SPEC_PART_TASKS = Array.from(
  { length: MAX_SPEC_PARTS },
  (_, index) => `test:spec:${String(index)}`
);

// regression: friends-spec-task-budget — part 7 took 627s against its 600s cap.
test('slow spec suites split into independently cached parts that all gate Check', () => {
  // regression: spec-task-batches-over-budget — friends 1,075s; sync 635s.
  expectSpecParts('libs/friends-harness', 64, ['friends', 'spaces']);
  expectSpecParts('pkgs/sync-engine-harness', 4, ['sync-engine']);
  // regression: chess-spec-task-budget — parts 3, 7, and 9 hit 600s; part 5 took 593s.
  expectSpecParts('libs/chess-root-harness', 64, ['chess']);
});

function expectSpecParts(dir: string, count: number, domains: string[]): void {
  const manifest = JSON.parse(
    readFileSync(join(REPO_ROOT, dir, 'package.json'), 'utf8')
  ) as { specParts: number; scripts: Record<string, string> };
  expect(manifest.specParts).toBe(count);
  expect(specPartProblems(dir, manifest)).toEqual([]);
  const tasks = loadTasks();
  const packageTasks = (
    JSON.parse(readFileSync(join(REPO_ROOT, dir, 'turbo.json'), 'utf8')) as {
      tasks: Tasks;
    }
  ).tasks;
  for (let part = 0; part < count; part++) {
    const task = `test:spec:${String(part)}`;
    expect(tasks['//#check']?.dependsOn).toContain(task);
    expect(tasks[task]?.outputs).toEqual([
      `.cache/harness-report/part-${String(part)}/**`,
    ]);
    for (const domain of domains) {
      expect(packageTasks[task]?.inputs).toContain(
        `$TURBO_ROOT$/specs/${domain}/**`
      );
    }
  }
}

/**
 * `//#check` is the whole check surface. Everything a package can check about
 * itself rides in its own `tc` / `lint` / `test` / `test:contract` /
 * `test:spec:<k>`, so it caches per package; root leaves are only the checks whose
 * subject belongs to no package.
 */
const CHECK_LEAVES = [
  '//#lint:root',
  '//#ci:syncpack',
  '//#ci:audit',
  '//#ci:i18n',
  '//#ci:agent-commands',
  '//#ci:workspace-lifecycle',
  '//#ci:goals',
  '//#ci:specs',
  '//#ci:statecharts',
  '//#ci:conformance',
  '//#ci:spec-ownership',
  'tc',
  'lint',
  'test',
  'test:contract',
  ...SPEC_PART_TASKS,
  'check:models',
  '@apps/product#check:offline-shell',
  '@apps/auth-relay#check:worker-bundle',
  '@apps/product#check:worker-bundle',
  '@libs/runtime-server#check:schema-evolution',
  '@libs/tools#check:actionlint',
  '@libs/tools#check:secrets',
  'check:board-contract',
];

/** Deploy runs the whole check surface, then the leaves that need a live env. */
const DEPLOY_ONLY = [
  '@apps/server#check:api',
  'health',
  '@libs/infra-shared#retire:workers',
] as const;

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
    // regression: chessboard-consumer-gate-graph
    // regression: check-spec-part-order
    expect(loadTasks()['//#check']?.dependsOn).toEqual(CHECK_LEAVES);
  });

  test('each spec part caches only its own report bucket', () => {
    // Two parts of one suite restore on the same machine; overlapping outputs
    // would let one part's cache entry clobber the other's report.
    const tasks = loadTasks();
    for (const [index, task] of SPEC_PART_TASKS.entries()) {
      expect(tasks[task]?.outputs, task).toEqual([
        `.cache/harness-report/part-${String(index)}/**`,
      ]);
    }
  });

  test('all Check tasks cache against current inputs, including fresh advisory evidence', () => {
    const tasks = loadTasks();
    const uncached = [...reachableFromCheck(tasks)].filter(
      (task) => configFor(tasks, task)?.cache === false
    );
    expect(uncached).toEqual([]);
    expect(tasks['//#ci:audit']?.inputs).toContain(
      '.cache/check-ci/audit.json'
    );
    expect(
      readFileSync(join(REPO_ROOT, 'libs/tools/scripts/check-plan.ts'), 'utf8')
    ).toContain('captureAudit(ROOT)');
  });

  // regression: check-tools-external-cache-inputs
  test('configuration readers invalidate on their literal external inputs', () => {
    const tools = JSON.parse(
      readFileSync(join(REPO_ROOT, 'libs/tools/turbo.json'), 'utf8')
    ) as { tasks: { test: { inputs: string[] } } };
    for (const input of [
      '$TURBO_ROOT$/.github/**',
      '$TURBO_ROOT$/specs/**',
      '$TURBO_ROOT$/apps/*/package.json',
      '$TURBO_ROOT$/libs/*/turbo.json',
    ])
      expect(tools.tasks.test.inputs).toContain(input);
    expect(loadTasks()['@libs/tools#check:actionlint']?.inputs).toContain(
      '$TURBO_ROOT$/.github/actionlint.yaml'
    );
  });

  // regression: check-duration-metadata-cache-input
  test('changing check-task-costs.json belongs to planning and JSON lint, not code verdicts', () => {
    const tools = JSON.parse(
      readFileSync(join(REPO_ROOT, 'libs/tools/turbo.json'), 'utf8')
    ) as { tasks: Record<string, { inputs: string[] }> };
    for (const task of ['src', 'tc', 'test'])
      expect(tools.tasks[task]!.inputs).toContain(
        '!scripts/check-task-costs.json'
      );
    expect(tools.tasks['lint']!.inputs).not.toContain(
      '!scripts/check-task-costs.json'
    );
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
      ...SPEC_PART_TASKS,
      'check:worker-bundle',
    ]) {
      expect(tasks[task]?.inputs?.[0], task).toBe('$TURBO_DEFAULT$');
    }
  });

  test('check:models hashes only the models and their checker', () => {
    // Hash the verifier and evidence implementations, never product runtime
    // or unrelated tooling tasks such as @libs/tools#tc.
    const task = loadTasks()['check:models'];
    expect(task?.dependsOn).toEqual([
      '@pkgs/quint-server#src',
      '@pkgs/quint-shared#src',
      '@pkgs/conformance-server#src',
      '@pkgs/conformance-shared#src',
    ]);
    expect(task?.inputs).not.toContain('$TURBO_DEFAULT$');
  });

  // every check that gates a release also gates a PR merge.
  test('//#deploy is //#check plus the live-env leaves', () => {
    const tasks = loadTasks();
    expect(tasks['//#deploy']?.dependsOn).toEqual(['//#check', ...DEPLOY_ONLY]);
    expect(flattenCheckAggregators(['deploy'], tasks)).toEqual([
      ...CHECK_LEAVES,
      ...DEPLOY_ONLY,
    ]);
  });

  test('local runners go through turbo-ci-run', () => {
    const scripts = loadRootScripts();
    expect(scripts['check:local']).toBe(
      'bun run libs/secrets-server/scripts/secrets-run.ts -- bun run libs/tools/scripts/check-local.ts'
    );
    expect(turboCiRunTaskArgs(scripts['deploy:local'] ?? '')).toEqual([
      '//#deploy',
    ]);
    expect(turboCiRunTaskArgs(scripts['health:local'] ?? '')).toEqual([
      'health',
    ]);
    expect(scripts['deploy:dev']).toContain('deploy:local');
    expect(scripts['deploy:prd']).toContain('deploy:local');
    expect(scripts['health:prd']).toContain('health:local');
  });

  test('checks run locally while health and deploy dispatch their workflows', () => {
    const scripts = loadRootScripts();
    const dispatch = 'libs/tools/scripts/workflow-remote.ts';
    expect(scripts['check']).toBe('bun run check:local');
    expect(scripts['verify']).toBe('bun run check:local');
    expect(scripts['health']).toBe(`bun run ${dispatch} health`);
    expect(scripts['deploy']).toBe(`bun run ${dispatch} deploy`);
    expect(scripts['health']).not.toContain('turbo-ci-run');
    expect(scripts['deploy']).not.toContain('turbo-ci-run');
    expect(scripts).not.toHaveProperty('check:remote');
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
    expect(health?.dependsOn).toContain('@libs/infra-server#apply:edge');
    expect(health?.dependsOn).toContain('@libs/billing-server#billing:sync');
  });

  test('infrastructure applies after install:cli (tofu, conftest, infisical)', () => {
    const deps = loadTasks()['@libs/infra-server#apply:foundation']?.dependsOn;
    expect(deps).toContain('@libs/tools#install:cli');
  });

  // regression: consolidated-deploy-check-aggregator — a package dependency
  // on //#check bypassed the runner's flattening and scheduled missing root
  // lint/test tasks, so even the deployment dry run failed.
  // regression: worker-retirement-health-dependency — bare health resolved
  // to a nonexistent infra health task and allowed retirement before health.
  // regression: tooling-check-subprocess-timeouts
  test('the retirement dependency chain is a runnable Turbo graph', () => {
    const result = spawnSync(
      join(REPO_ROOT, 'node_modules/.bin/turbo'),
      [
        'query',
        `query {
        package(name: "@libs/infra-shared") {
          tasks(filter: { equal: { field: NAME, value: "retire:workers" } }) {
            items { fullName command
              directDependencies { items { fullName command } }
              allDependencies { items { fullName command } }
            }
          }
        }
      }`,
      ],
      { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    type Task = { fullName: string; command: string | null };
    const graph = JSON.parse(result.stdout) as {
      errors?: unknown;
      data: {
        package: {
          tasks: {
            items: (Task & {
              directDependencies: { items: Task[] };
              allDependencies: { items: Task[] };
            })[];
          };
        };
      };
    };
    expect(graph.errors).toBeUndefined();
    const [retirement] = graph.data.package.tasks.items;
    expect(retirement?.fullName).toBe('@libs/infra-shared#retire:workers');
    expect(retirement?.directDependencies.items).toEqual([
      {
        fullName: '@apps/product#health',
        command: 'bun run scripts/health.ts',
      },
    ]);
    // A root dependency without an actual script cannot execute in a deployment.
    for (const dependency of retirement!.allDependencies.items) {
      if (dependency.fullName.startsWith('//#'))
        expect(dependency.command).not.toBeNull();
    }
  });

  test('one application deployment follows migration and its checks', () => {
    const tasks = loadTasks();
    // regression: product-deploy-dist-race — while Wrangler uploaded
    // apps/product/dist/assets/src-C2k0tIiA.js, a parallel Check build emptied
    // dist and replaced the content-hashed asset before an upload stream read it.
    expect(tasks['@apps/product#deploy']?.dependsOn).toEqual([
      '@libs/runtime-server#migrate',
      '@libs/chess-puzzle-server#initialize:catalog',
      '@apps/server#check:api',
      '@apps/product#check:offline-shell',
      '@apps/product#check:worker-bundle',
    ]);
    expect(tasks).not.toHaveProperty('@apps/server#deploy');
    expect(tasks).not.toHaveProperty('@apps/room-server#deploy');
    expect(tasks['@libs/infra-server#apply:edge']?.dependsOn).toEqual([
      '@apps/product#deploy',
    ]);
    expect(tasks['@libs/infra-shared#retire:workers']?.dependsOn).toEqual([
      '@apps/product#health',
    ]);
    expect(tasks['@apps/product#check:worker-bundle']?.dependsOn).toEqual([
      '^src',
      'build',
    ]);
  });
});

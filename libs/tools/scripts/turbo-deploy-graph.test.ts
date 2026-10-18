import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SECRETS_RANGE_ENV } from './secrets-scan-range';
import {
  MAX_MODEL_PARTS,
  MAX_SPEC_PARTS,
  specPackages,
  specPartProblems,
} from './spec-packages';
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
  expect(loadTasks()['@libs/tools#ci:spec-ownership']?.env).toContain(
    SECRETS_RANGE_ENV
  );
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

/** A split models check's parts (`check-models.ts --part k/n`). */
const MODEL_PART_TASKS = Array.from(
  { length: MAX_MODEL_PARTS },
  (_, index) => `check:models:${String(index)}`
);

// regression: friends-spec-task-budget — part 7 took 627s against its 600s cap.
test('slow spec suites split into independently cached parts that all gate Check', () => {
  // regression: spec-task-batches-over-budget — friends 1,075s; sync 635s.
  expectSpecParts('libs/friends-harness', 64, ['friends', 'spaces']);
  expectSpecParts('pkgs/sync-engine-harness', 4, ['sync-engine']);
  // regression: chess-spec-task-budget — parts 3, 7, and 9 hit 600s; part 5 took 593s.
  // The custom-game, matched-game and puzzle models moved to every game's
  // suite, and their parts with them: chess keeps the fewest its seven
  // models' trace caps allow, games the fewest its sixteen models' do.
  expectSpecParts('libs/chess-root-harness', 32, ['chess']);
  expectSpecParts('libs/games-harness', 64, ['games']);
});

// regression: ci-chess-board-omits-inherited-spec-inputs
test('every spec package retains its inherited runner and exact source inputs', () => {
  expect(loadTasks()['@libs/tools#ci:specs']?.inputs).toContain(
    '$TURBO_ROOT$/turbo.json'
  );
  for (const pkg of specPackages()) {
    const manifest = JSON.parse(
      readFileSync(join(REPO_ROOT, pkg.dir, 'package.json'), 'utf8')
    ) as { specParts?: number };
    if (manifest.specParts === undefined) continue;
    expectSpecParts(pkg.dir, manifest.specParts, pkg.specDomains);
  }
});

function expectSpecParts(
  dir: string,
  count: number,
  domains: readonly string[]
): void {
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
  const covered = new Set<string>();
  for (let part = 0; part < count; part++) {
    const task = `test:spec:${String(part)}`;
    expect(CHECK_LEAVES).toContain(task);
    expect(tasks[task]?.outputs).toEqual([
      `.cache/harness-report/part-${String(part)}/**`,
    ]);
    expect(packageTasks[task]?.inputs).toContain('$TURBO_EXTENDS$');
    const input = `.cache/spec-inputs/part-${String(part)}.json`;
    expect(tasks[task]?.inputs).toContain(input);
    expect(tasks[task]?.dependsOn).toContain('prepare:spec');
    const fingerprint = JSON.parse(
      readFileSync(join(REPO_ROOT, dir, input), 'utf8')
    ) as {
      files: Record<string, string>;
    };
    for (const path of Object.keys(fingerprint.files)) covered.add(path);
  }
  for (const domain of domains)
    expect(
      [...covered].some((path) => path.startsWith(`specs/${domain}/`))
    ).toBe(true);
}

/**
 * The command's Turbo task list covers package checks and explicitly scoped
 * repository checks; there are no root check tasks.
 */
const CHECK_LEAVES = [
  '@libs/tools#check:root-lint',
  '@libs/tools#ci:syncpack',
  '@libs/tools#ci:audit',
  '@libs/tools#ci:i18n',
  '@libs/tools#ci:agent-commands',
  '@libs/tools#ci:workspace-lifecycle',
  '@libs/tools#ci:goals',
  '@libs/tools#ci:specs',
  '@libs/tools#ci:statecharts',
  '@libs/tools#ci:conformance',
  '@libs/tools#ci:spec-ownership',
  'tc',
  'lint',
  'test',
  'test:contract',
  'test:contract:render',
  ...Array.from({ length: 11 }, (_, index) => `test:contract:${String(index)}`),
  ...SPEC_PART_TASKS,
  'check:models',
  ...MODEL_PART_TASKS,
  '@apps/product#check:offline-shell',
  '@apps/product#test:release-journeys',
  '@apps/auth-relay#check:worker-bundle',
  '@apps/product#check:worker-bundle',
  '@libs/runtime-server#check:schema-evolution',
  '@libs/tools#check:actionlint',
  '@libs/tools#check:secrets',
  'check:board-contract',
  '@apps/synthetic-population-worker#check:synthetic-population-foundation',
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

/** Every task `sharded Check task list` can schedule, through `dependsOn` and `^deps`. */
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

  test('sharded Check task list is exactly the check surface', () => {
    // regression: chessboard-consumer-gate-graph
    // regression: check-spec-part-order
    expect(flattenCheckAggregators(['check'], loadTasks())).toEqual(
      CHECK_LEAVES
    );
    expect(
      Object.keys(loadTasks()).some(
        (task) =>
          task.startsWith('//#check') ||
          task.startsWith('//#ci:') ||
          task.startsWith('//#lint:root')
      )
    ).toBe(false);
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
    expect(tasks['@libs/tools#ci:audit']?.inputs).toContain(
      '$TURBO_ROOT$/.cache/check-ci/audit.json'
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
      'test:contract:render',
      ...Array.from(
        { length: 11 },
        (_, index) => `test:contract:${String(index)}`
      ),
      ...SPEC_PART_TASKS,
      'check:worker-bundle',
    ]) {
      expect(tasks[task]?.inputs?.[0], task).toBe('$TURBO_DEFAULT$');
    }
  });

  test('every package lint task hashes the shared design-system rules and presets', () => {
    const sharedInputs = [
      '$TURBO_ROOT$/libs/tools/scripts/design-vocabulary.ts',
      '$TURBO_ROOT$/pkgs/tailwind-shared/src/lint.css',
      '$TURBO_ROOT$/pkgs/tailwind-shared/src/tailwind.css',
      '$TURBO_ROOT$/pkgs/ui-root-client/codemod/theme.css',
      '$TURBO_ROOT$/pkgs/ui-root-client/src/hosts.css',
    ];
    const tasks = loadTasks();
    const lintTasks = Object.entries(tasks).filter(
      ([name]) => name === 'lint' || name.endsWith('#lint')
    );

    expect(lintTasks.length).toBeGreaterThan(0);
    for (const [name, task] of lintTasks) {
      for (const input of sharedInputs) {
        expect(task.inputs, `${name} misses ${input}`).toContain(input);
      }
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
    // A part is the same check over a share of the models.
    for (const part of MODEL_PART_TASKS)
      expect(loadTasks()[part], part).toEqual(task);
    const contract = loadTasks()['test:contract'];
    for (let index = 0; index < 11; index += 1) {
      const name = `test:contract:${String(index)}`;
      expect(loadTasks()[name], name).toEqual(contract);
    }
  });

  // every check that gates a release also gates a PR merge.
  test('deploy depends only on live-environment tasks after the Check workflow', () => {
    const tasks = loadTasks();
    expect(tasks['//#deploy']?.dependsOn).toEqual([...DEPLOY_ONLY]);
    expect(flattenCheckAggregators(['deploy'], tasks)).toEqual([
      ...DEPLOY_ONLY,
    ]);
  });

  test('local runners go through turbo-ci-run', () => {
    const scripts = loadRootScripts();
    // One entry program; the profile is the only thing that differs.
    for (const profile of ['pr', 'nightly'])
      expect(scripts[`check-${profile}`]).toBe(
        `CHECK_PROFILE=${profile} bun run libs/secrets-server/scripts/secrets-run.ts -- bun run libs/tools/scripts/check-local.ts`
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
    for (const retired of ['check', 'verify', 'check:local'])
      expect(scripts[retired]).toBeUndefined();
    for (const workflow of ['health', 'deploy']) {
      // The command is a Turborepo run of the one task that dispatches.
      expect(scripts[workflow]).toBe(`turbo run //#task:${workflow} --`);
      expect(scripts[`task:${workflow}`]).toBe(
        `bun run ${dispatch} ${workflow}`
      );
      expect(loadTasks()[`//#task:${workflow}`]?.dependsOn).toBeUndefined();
    }
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

  // regression: consolidated-deploy-check-aggregator — package tasks must not
  // depend on a root check task outside the Turbo task list.
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

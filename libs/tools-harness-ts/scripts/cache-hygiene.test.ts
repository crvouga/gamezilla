import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  blastRadii,
  type GraphPackage,
  readGraph,
  toRepoPath,
} from './cache-graph';
import {
  broadInputViolations,
  derivedViolations,
  globalInputViolations,
  hubViolations,
  isBroadInput,
  type Policy,
  type Violation,
} from './cache-hygiene';
import { visibleDirectories } from './src-task-edges';
import { cacheHygieneViolations, readPolicy } from './verify-cache-hygiene';

const ROOT = join(import.meta.dirname, '../../..');

const POLICY: Policy = {
  limits: {
    hubBlast: 4,
    largeHubBlast: 8,
    maxFilesAtHub: 6,
    maxFilesAtLargeHub: 3,
    cohesion: { minFiles: 4, minLight: 3, lightShare: 0.5, lightReach: 0.2 },
    growth: { share: 0.1, packages: 1 },
  },
  hubs: {},
  grandfathered: { size: {}, cohesion: {} },
  broadInputs: {},
  globalDependencies: ['tsconfig.base.json'],
  globalEnv: [],
};

function pkg(
  name: string,
  declared: string[],
  srcEdges: string[] = declared,
  files = 1
): GraphPackage {
  return {
    name,
    dir: `pkgs/${name}`,
    declared: new Set(declared),
    srcEdges: new Set(srcEdges),
    srcFiles: Array.from(
      { length: files },
      (_, i) => `pkgs/${name}/src/${i}.ts`
    ),
  };
}

/** `core` and `n` packages that depend on it. */
function fan(n: number, core = pkg('core', [], [], 1)): GraphPackage[] {
  return [
    core,
    ...Array.from({ length: n }, (_, i) => pkg(`user${String(i)}`, ['core'])),
  ];
}

function rules(violations: readonly Violation[]): string[] {
  return violations.map((v) => `${v.rule}:${v.subject}`);
}

function hubs(
  packages: GraphPackage[],
  policy: Policy = POLICY,
  light: (p: GraphPackage) => { file: string; packages: number }[] = () => []
): Violation[] {
  return hubViolations(
    { packages, blast: blastRadii(packages), policy },
    light
  );
}

// ---------------------------------------------------------------- the graph

// The import graph is keyed by `/` paths; Windows joins with `\`. A key that
// does not match made every file look private and every hub incohesive.
test('repository paths use / on every platform', () => {
  expect(
    toRepoPath(
      'C:\\actions-runner\\_work\\repo',
      'C:\\actions-runner\\_work\\repo\\libs\\a-ts\\src\\b.ts'
    )
  ).toBe('libs/a-ts/src/b.ts');
  expect(toRepoPath('/repo', '/repo/libs/a-ts/src/b.ts')).toBe(
    'libs/a-ts/src/b.ts'
  );
  for (const pkg of readGraph(ROOT))
    for (const file of pkg.srcFiles) expect(file).not.toContain('\\');
});

test('an edit reruns the package, its src dependents, and whoever declares them', () => {
  const packages = [
    pkg('base', []),
    pkg('middle', ['base']),
    pkg('top', ['middle']),
    pkg('tests-only', ['base'], []),
    pkg('unrelated', []),
  ];
  const blast = blastRadii(packages);
  expect([...(blast.get('base')?.packages ?? [])].sort()).toEqual([
    'base',
    'middle',
    'tests-only',
    'top',
  ]);
  // `tests-only` reruns its own tasks but passes the edit no further.
  expect([...(blast.get('base')?.srcHashes ?? [])].sort()).toEqual([
    'base',
    'middle',
    'top',
  ]);
  expect([...(blast.get('unrelated')?.packages ?? [])]).toEqual(['unrelated']);
});

// ----------------------------------------------------------------- hubs

test('a package that reruns few others is not a hub', () => {
  expect(hubs(fan(2))).toEqual([]);
});

test('a new hub fails and says how to avoid being one', () => {
  const [violation, ...rest] = hubs(fan(5));
  expect(rest).toEqual([]);
  expect(violation?.rule).toBe('hub-new');
  expect(violation?.message).toContain('6 of 6 packages');
  expect(violation?.message).toContain('Why:');
  expect(violation?.message).toContain('bun run cache:explain core');
  expect(violation?.message).toContain('devDependencies');
});

test('an accepted hub passes until it grows past the tolerance', () => {
  const accepted: Policy = { ...POLICY, hubs: { core: 6 } };
  expect(hubs(fan(5), accepted)).toEqual([]);
  expect(hubs(fan(6), accepted)).toEqual([]);
  const grown = hubs(fan(9), accepted);
  expect(rules(grown)).toEqual(['hub-growth:core']);
  expect(grown[0]?.message).toContain('accepted 6');
  expect(grown[0]?.message).toContain('--accept-hubs');
});

test('a hub with more source files than its limit fails unless grandfathered', () => {
  const big = fan(5, pkg('core', [], [], 7));
  const accepted: Policy = { ...POLICY, hubs: { core: 6 } };
  const [violation] = hubs(big, accepted);
  expect(violation?.rule).toBe('hub-size');
  expect(violation?.message).toContain('7 source files');
  expect(violation?.message).toContain('limit for a hub is 6');
  const grandfathered: Policy = {
    ...accepted,
    grandfathered: {
      size: { core: { files: 7, reason: 'predates the gate' } },
      cohesion: {},
    },
  };
  expect(hubs(big, grandfathered)).toEqual([]);
  const grew = fan(5, pkg('core', [], [], 8));
  expect(rules(hubs(grew, grandfathered))).toEqual(['hub-size:core']);
});

test('a large hub has a lower file limit', () => {
  const accepted: Policy = { ...POLICY, hubs: { core: 10 } };
  const [violation] = hubs(fan(9, pkg('core', [], [], 4)), accepted);
  expect(violation?.message).toContain('limit for a large hub is 3 files');
});

test('files that reach few packages in a hub fail with the files named', () => {
  const accepted: Policy = { ...POLICY, hubs: { core: 6 } };
  const packages = fan(5, pkg('core', [], [], 4));
  const light = (p: GraphPackage) =>
    p.name === 'core'
      ? [
          { file: 'pkgs/core/src/a.ts', packages: 1 },
          { file: 'pkgs/core/src/b.ts', packages: 1 },
          { file: 'pkgs/core/src/c.ts', packages: 2 },
        ]
      : [];
  const [violation] = hubs(packages, accepted, light);
  expect(violation?.rule).toBe('hub-cohesion');
  expect(violation?.message).toContain('pkgs/core/src/a.ts (reaches 1)');
  expect(violation?.message).toContain('Fix: move them');
  const grandfathered: Policy = {
    ...accepted,
    grandfathered: {
      size: {},
      cohesion: { core: { light: 3, reason: 'consumed through a preload' } },
    },
  };
  expect(hubs(packages, grandfathered, light)).toEqual([]);
});

// --------------------------------------------------------- broad inputs

test('a glob over every package is broad; a list of named packages is not', () => {
  for (const broad of [
    '$TURBO_ROOT$/libs/*/package.json',
    '$TURBO_ROOT$/{apps,libs,pkgs}/*/src/**',
    '$TURBO_ROOT$/pkgs/**/*.feature',
    '$TURBO_ROOT$/libs/*-client-ts/src/sub-client.ts',
    '$TURBO_ROOT$/**',
    '$TURBO_ROOT$/{apps/*,libs/x}/package.json',
  ])
    expect(isBroadInput(broad), broad).toBe(true);
  for (const narrow of [
    '$TURBO_ROOT$/libs/{a,b}/package.json',
    '$TURBO_ROOT$/pkgs/os-shared-ts/src/**',
    '$TURBO_ROOT$/{apps/product-ts,libs/harness-ts}/scripts/**',
    '$TURBO_ROOT$/specs/**',
    '$TURBO_ROOT$/biome.json',
    '!$TURBO_ROOT$/libs/*/package.json',
    'src/**',
    '$TURBO_DEFAULT$',
  ])
    expect(isBroadInput(narrow), narrow).toBe(false);
});

test('a task with a broad glob fails unless allowed, and only up to its count', () => {
  const task = {
    task: '@apps/client-ts#test',
    inputs: ['$TURBO_DEFAULT$', '$TURBO_ROOT$/libs/*/package.json'],
  };
  const [violation] = broadInputViolations([task], POLICY);
  expect(violation?.rule).toBe('broad-input');
  expect(violation?.message).toContain('`$TURBO_ROOT$/libs/*/package.json`');
  expect(violation?.message).toContain('brace list');
  expect(violation?.message).toContain('cache-hygiene.json');
  const allowed: Policy = {
    ...POLICY,
    broadInputs: {
      '@apps/client-ts#test': { patterns: 1, reason: 'reads every manifest' },
    },
  };
  expect(broadInputViolations([task], allowed)).toEqual([]);
  const more = { ...task, inputs: [...task.inputs, '$TURBO_ROOT$/pkgs/*/x'] };
  const [again] = broadInputViolations([more], allowed);
  expect(again?.message).toContain('allows 1 (reads every manifest)');
});

// ---------------------------------------------------------- global inputs

test('a new global dependency, a new global variable, or aliases in the base config fail', () => {
  const violations = globalInputViolations(
    {
      globalDependencies: ['tsconfig.base.json', 'biome.json'],
      globalEnv: ['CI_SECRET'],
      baseHasAliases: true,
    },
    POLICY
  );
  expect(rules(violations)).toEqual([
    'global-dependency:biome.json',
    'global-dependency:CI_SECRET',
    'global-alias:tsconfig.base.json',
  ]);
  expect(violations[0]?.message).toContain('$TURBO_ROOT$/biome.json');
  expect(violations[2]?.message).toContain('tsconfig.paths.json');
  expect(
    globalInputViolations(
      {
        globalDependencies: ['tsconfig.base.json'],
        globalEnv: [],
        baseHasAliases: false,
      },
      POLICY
    )
  ).toEqual([]);
});

// -------------------------------------------------------------- derived

test('stale derived files are reported with the one command that fixes them', () => {
  expect(derivedViolations({ srcEdges: [], biomeSlices: [] })).toEqual([]);
  const [edges, slices] = derivedViolations({
    srcEdges: ['pkgs/a/turbo.json'],
    biomeSlices: ['biome.shared.json', 'pkgs/a/biome-scope.json'],
  });
  expect(edges?.message).toContain('bun run cache:sync');
  expect(slices?.message).toContain('2 Biome slices out of date');
});

test('every message names the problem, the cost and the fix', () => {
  const messages = [
    ...hubs(fan(5)),
    ...hubs(fan(9), { ...POLICY, hubs: { core: 6 } }),
    ...broadInputViolations(
      [{ task: 't', inputs: ['$TURBO_ROOT$/libs/*/package.json'] }],
      POLICY
    ),
    ...globalInputViolations(
      { globalDependencies: ['x'], globalEnv: ['Y'], baseHasAliases: true },
      POLICY
    ),
    ...derivedViolations({ srcEdges: ['a'], biomeSlices: ['b'] }),
  ].map((v) => v.message);
  expect(messages.length).toBeGreaterThan(5);
  for (const message of messages) {
    expect(message).toContain('Why:');
    expect(message).toContain('Fix:');
  }
});

// ---------------------------------------------------------------- repo

test('cache-hygiene.json explains every exception it holds', () => {
  const policy = readPolicy();
  const reasons = [
    ...Object.values(policy.grandfathered.size),
    ...Object.values(policy.grandfathered.cohesion),
    ...Object.values(policy.broadInputs),
  ].map((entry) => entry.reason.trim());
  expect(reasons.length).toBeGreaterThan(0);
  expect(reasons.filter((reason) => reason.length < 12)).toEqual([]);
});

test('the workspace has no cache hygiene violation', () => {
  expect(
    cacheHygieneViolations().map((v) => `[${v.rule}] ${v.message}`)
  ).toEqual([]);
});

// The rules are only as good as the graph they compute. Turborepo is the
// authority: its dry run lists, for every task, the tasks it waits for.
test('the blast radius computed here matches the packages Turborepo reruns', () => {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('TURBO_'))
  );
  const run = spawnSync(
    join(ROOT, 'node_modules/.bin/turbo'),
    ['run', 'lint', 'tc', 'test', '--dry=json'],
    {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      env: { ...env, TURBO_TELEMETRY_DISABLED: '1', TURBO_CACHE: 'local:r' },
    }
  );
  expect(run.status, run.stderr).toBe(0);
  const tasks = (
    JSON.parse(run.stdout) as {
      tasks: { taskId: string; package: string; dependencies: string[] }[];
    }
  ).tasks;
  const waitingOn = new Map<string, string[]>();
  for (const task of tasks)
    for (const dependency of task.dependencies)
      waitingOn.set(dependency, [
        ...(waitingOn.get(dependency) ?? []),
        task.taskId,
      ]);
  const packages = readGraph(ROOT);
  const blast = blastRadii(packages);
  for (const name of [
    '@pkgs/os-shared-ts',
    '@pkgs/fs-server-ts',
    '@pkgs/dev-owner-server-ts',
    '@pkgs/turn-game-shared-ts',
  ]) {
    const seen = new Set([`${name}#src`]);
    for (const next of seen)
      for (const dependent of waitingOn.get(next) ?? []) seen.add(dependent);
    const rerun = new Set(
      [...seen]
        .map((taskId) => taskId.split('#')[0] ?? '')
        .filter((owner) =>
          tasks.some(
            (t) =>
              t.package === owner &&
              /^(lint|tc|test)/.test(t.taskId.split('#')[1] ?? '') &&
              seen.has(t.taskId)
          )
        )
    );
    rerun.add(name);
    expect(
      [...(blast.get(name)?.packages ?? [])].sort(),
      `${name}: update cache-graph.ts or the src edges`
    ).toEqual([...rerun].sort());
  }
}, 120_000);

// The gate and the tests that run it read every directory a dependent can see.
// A package that starts exporting another one has to be listed as an input.
test('the gate and the tools tests hash every directory a package exports', () => {
  const inputsOf = (file: string, task: string): string[] =>
    (
      JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as {
        tasks: Record<string, { inputs?: string[] }>;
      }
    ).tasks[task]?.inputs?.map((input) => input.replace('$TURBO_ROOT$/', '')) ??
    [];
  const gate = inputsOf(
    'turbo.json',
    '@libs/tools-harness-ts#ci:cache-hygiene'
  );
  const tests = inputsOf('libs/tools-harness-ts/turbo.json', 'test');
  const missing: string[] = [];
  for (const pkg of readGraph(ROOT)) {
    const manifest = JSON.parse(
      readFileSync(join(ROOT, pkg.dir, 'package.json'), 'utf8')
    ) as { exports?: unknown };
    for (const visible of visibleDirectories(manifest.exports)) {
      const sample = `${pkg.dir}/${visible}/file.ts`;
      for (const [label, inputs] of [
        ['ci:cache-hygiene', gate],
        ['tools-harness test', tests],
      ] as const)
        if (!inputs.some((input) => new Bun.Glob(input).match(sample)))
          missing.push(`${label}: ${pkg.dir}/${visible}/**`);
    }
  }
  expect(
    missing,
    'add the directory to the inputs of both tasks in turbo.json and libs/tools-harness-ts/turbo.json'
  ).toEqual([]);
});

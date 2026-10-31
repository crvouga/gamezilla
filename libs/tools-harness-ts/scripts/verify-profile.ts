/**
 * The two verification profiles: one set of tests, run at two depths.
 *
 * - `release` is the whole gate, bounded and deterministic, with no reports:
 *   every pull request (`.github/workflows/verify-pr.yml`), Release's
 *   verification of the exact commit it ships, and `bun verify`. A pull
 *   request runs the very gate Release runs, so it fails whenever Release
 *   would, and every task it passes has the hash Release restores from the
 *   remote cache.
 * - `nightly` is the comprehensive run (`bun verify-nightly`,
 *   `.github/workflows/verify-nightly.yml`): the whole gate at a deeper
 *   budget, plus the suites below that are too slow or too exploratory to
 *   block a merge. It keeps and publishes every report.
 *
 * A profile never names a test of its own. It sets the depth the tasks
 * already read from their environment, and says whether reports are kept.
 * `VERIFY_PROFILE` selects it; unset is `release`.
 *
 * A finding the nightly run makes is pinned as a regression in the suite
 * that found it, which puts it in the `release` profile from then on.
 */

export const PROFILE_ENV = 'VERIFY_PROFILE';

export type VerifyProfileName = 'release' | 'nightly';

export type VerifyProfile = {
  readonly name: VerifyProfileName;
  /**
   * Depth budgets the tasks read. Each is part of its task's cache key, so
   * the two profiles never answer for one another. A value already in the
   * environment wins: `PBT_NUM_RUNS=1000 bun verify-nightly` goes deeper.
   */
  readonly env: Readonly<Record<string, string>>;
  /** Whether test reports and evidence are retained and published. */
  readonly reports: boolean;
  /** Multiplies every per-task budget in `verify-budget.ts`. */
  readonly taskBudgetScale: number;
  /** Run deadline in seconds; `null` keeps the `verify-budget.ts` defaults. */
  readonly deadlineSeconds: {
    readonly ci: number;
    readonly local: number;
  } | null;
  /** Keep running independent tasks after one fails, so every suite reports. */
  readonly continueAfterFailure: boolean;
};

const PROFILES: Readonly<Record<VerifyProfileName, VerifyProfile>> = {
  release: {
    name: 'release',
    env: {},
    reports: false,
    taskBudgetScale: 1,
    deadlineSeconds: null,
    continueAfterFailure: false,
  },
  nightly: {
    name: 'nightly',
    env: {
      // Replay every drawn trace of every Quint model, not the fewest that
      // take each bound action.
      QUINT_REPLAY_TRACES: 'all',
      // Five times the pinned property budget, on the pinned seed: the same
      // draw every night until the code changes. `test:pbt:random` is the
      // suite that leaves the pin.
      PBT_NUM_RUNS: '200',
      // Seeds per determinism-fuzz run (`@apps/product-ts#test:fuzz`).
      HARNESS_FUZZ_SEEDS: '2',
    },
    reports: true,
    // Five times the property runs and up to four times the model replays.
    taskBudgetScale: 4,
    // A shard holds about a minute of pull-request work, so fifty minutes is
    // slack for the deepest one; a laptop runs the whole corpus in one slot.
    deadlineSeconds: { ci: 3000, local: 21_600 },
    continueAfterFailure: true,
  },
};

export type NightlySuite = {
  /** What the suite is for, in the nightly verdict. */
  readonly summary: string;
  /** Turbo task ids, run through `turbo-ci-run.ts` like every gate task. */
  readonly tasks: readonly string[];
  /**
   * The suite's compute budget: its run is killed here, and no task of it has
   * a tighter one. Its workflow step's `timeout-minutes` stays above this.
   */
  readonly deadlineSeconds: number;
};

/**
 * Suites only the nightly profile runs. Each is one `verify-nightly:<name>`
 * job in the workflow and one `verify-nightly:<name>` argument to
 * `turbo-ci-run.ts`; `verify-profile.test.ts` holds the two in step.
 */
export const NIGHTLY_SUITES = {
  random: {
    summary:
      'Randomized hunting: fresh-seed property runs, determinism fuzz, scripted mutants',
    tasks: [
      '//#task:test:pbt:random',
      '@apps/product-ts#test:fuzz',
      '@pkgs/db-indexes-root-shared-ts#mutants',
    ],
    deadlineSeconds: 9000,
  },
  browser: {
    summary:
      'Every spec suite in real browsers against a booted localhost stack',
    tasks: ['@apps/product-ts#test:stack'],
    deadlineSeconds: 18_000,
  },
  visual: {
    summary: 'UI quality of every recorded product state',
    tasks: [
      '@apps/product-ts#verify:ui-quality',
      '@pkgs/ui-root-harness-ts#storybook:test',
      '@pkgs/ui-root-harness-ts#storybook:mcp:test',
    ],
    deadlineSeconds: 7200,
  },
  coverage: {
    summary: 'Line and assertion coverage of the unit suites',
    tasks: ['//#task:verify:coverage'],
    deadlineSeconds: 5400,
  },
  performance: {
    summary: 'Hot-path benchmarks',
    tasks: [
      '@pkgs/room-root-harness-ts#bench',
      '@libs/pong-harness-ts#bench',
      '@pkgs/sql-root-shared-ts#perf',
    ],
    deadlineSeconds: 1800,
  },
} as const satisfies Readonly<Record<string, NightlySuite>>;

export type NightlySuiteName = keyof typeof NIGHTLY_SUITES;

const GATE_AGGREGATOR = 'verify';
const NIGHTLY_AGGREGATOR = 'verify-nightly';

function isProfileName(value: string): value is VerifyProfileName {
  return Object.hasOwn(PROFILES, value);
}

function isSuiteName(value: string): value is NightlySuiteName {
  return Object.hasOwn(NIGHTLY_SUITES, value);
}

/** The profile `VERIFY_PROFILE` names; unset or empty is the whole gate. */
export function activeProfile(
  env: NodeJS.ProcessEnv = process.env
): VerifyProfile {
  const name = env[PROFILE_ENV]?.trim() ?? '';
  if (name === '') return PROFILES.release;
  if (!isProfileName(name))
    throw new Error(
      `${PROFILE_ENV}=${name} is not a verification profile (${Object.keys(PROFILES).join(', ')})`
    );
  return PROFILES[name];
}

/**
 * The tasks a command-line aggregator stands for, or `null` when `arg` is
 * not one. `verify` is the gate at the active profile's depth,
 * `verify-nightly` is the gate plus every nightly suite, and
 * `verify-nightly:<suite>` is one suite.
 */
export function verifyAggregatorTasks(
  arg: string,
  gateTasks: readonly string[]
): readonly string[] | null {
  if (arg === GATE_AGGREGATOR) return gateTasks;
  if (arg === NIGHTLY_AGGREGATOR)
    return [
      ...gateTasks,
      ...Object.values(NIGHTLY_SUITES).flatMap((suite) => suite.tasks),
    ];
  if (!arg.startsWith(`${NIGHTLY_AGGREGATOR}:`)) return null;
  const suite = arg.slice(NIGHTLY_AGGREGATOR.length + 1);
  if (!isSuiteName(suite))
    throw new Error(
      `${arg} is not a nightly suite (${Object.keys(NIGHTLY_SUITES).join(', ')})`
    );
  return NIGHTLY_SUITES[suite].tasks;
}

/**
 * What `bun verify` / `bun verify-nightly` hand `turbo-ci-run.ts`. The
 * nightly command takes group names: `bun verify-nightly random coverage`
 * runs those suites, `gate` is the merge gate alone at nightly depth, and no
 * name is everything. Other arguments pass through.
 */
export function localVerifyArgs(
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env
): string[] {
  if (activeProfile(env).name !== 'nightly') return [GATE_AGGREGATOR, ...args];
  const groups = args.filter((arg) => arg === 'gate' || isSuiteName(arg));
  const rest = args.filter((arg) => !groups.includes(arg));
  if (groups.length === 0) return [NIGHTLY_AGGREGATOR, ...rest];
  return [
    ...groups.map((group) =>
      group === 'gate' ? GATE_AGGREGATOR : `${NIGHTLY_AGGREGATOR}:${group}`
    ),
    ...rest,
  ];
}

function suiteOfAggregator(arg: string): NightlySuite | null {
  if (!arg.startsWith(`${NIGHTLY_AGGREGATOR}:`)) return null;
  const suite = arg.slice(NIGHTLY_AGGREGATOR.length + 1);
  return isSuiteName(suite) ? NIGHTLY_SUITES[suite] : null;
}

/**
 * The deadline of a run that names nightly suites (the longest of them), or
 * `null` when it names none.
 */
export function suiteDeadlineSeconds(args: readonly string[]): number | null {
  const deadlines = args.flatMap((arg) => {
    const suite = suiteOfAggregator(arg);
    return suite === null ? [] : [suite.deadlineSeconds];
  });
  return deadlines.length === 0 ? null : Math.max(...deadlines);
}

/** A nightly suite task is budgeted by its suite's deadline alone. */
export function suiteTaskBudgetSeconds(taskId: string): number | null {
  const suite = Object.values<NightlySuite>(NIGHTLY_SUITES).find((candidate) =>
    candidate.tasks.includes(taskId)
  );
  return suite?.deadlineSeconds ?? null;
}

/**
 * Give `env` the active profile's depth. Explicit values stay: a profile
 * sets defaults, it never overrides what a person asked for.
 */
export function applyProfileEnv(env: NodeJS.ProcessEnv): void {
  for (const [name, value] of Object.entries(activeProfile(env).env))
    if ((env[name]?.trim() ?? '') === '') env[name] = value;
}

/** The active profile's run deadline, or `null` for the default one. */
export function profileDeadlineSeconds(
  env: NodeJS.ProcessEnv,
  ci: boolean
): number | null {
  const deadline = activeProfile(env).deadlineSeconds;
  if (deadline === null) return null;
  return ci ? deadline.ci : deadline.local;
}

/** A per-task budget at the active profile's depth. */
export function profileBudgetSeconds(
  seconds: number,
  env: NodeJS.ProcessEnv = process.env
): number {
  return seconds * activeProfile(env).taskBudgetScale;
}

/** What a nightly run needs to be run again: the profile and its depth. */
export function profileManifest(env: NodeJS.ProcessEnv): {
  readonly profile: VerifyProfileName;
  readonly env: Readonly<Record<string, string>>;
  readonly reproduce: string;
} {
  const profile = activeProfile(env);
  const depth = Object.fromEntries(
    Object.keys(profile.env).map((name) => [name, env[name] ?? ''])
  );
  const assignments = Object.entries(depth)
    .map(([name, value]) => `${name}=${value}`)
    .join(' ');
  return {
    profile: profile.name,
    env: depth,
    reproduce:
      profile.name === 'nightly'
        ? `${assignments} bun verify-nightly`
        : 'bun verify',
  };
}

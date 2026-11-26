/**
 * Verification depth is separate from task selection (`ci-stage.ts`): every
 * profile runs the whole gate catalog. Release depth is bounded and
 * deterministic, without retained reports. Nightly runs the same catalog at
 * deeper budgets plus the suites below, retaining reports. Local `bun verify`
 * is release depth. A profile never defines different tests: environment
 * budgets participate in task hashes. Pin nightly findings in their owning
 * gate suites, which every Release then runs.
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

/** The longest any Verify Nightly job may run, setup included. */
export const NIGHTLY_JOB_MINUTES = 45;
/**
 * A nightly suite runner's compute budget:
 * under the job limit with room for checkout, setup and the step's own
 * timeout to fire after it.
 */
const SHARD_DEADLINE_SECONDS = 2280;

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
    // The gate plans each shard to fill part of this (`verify-plan.ts`), so
    // a deeper night spreads over more shards rather than longer ones; a
    // laptop runs the whole corpus in one slot.
    // Leave time inside the 35-minute hosted gate job for setup and evidence.
    deadlineSeconds: { ci: 32 * 60, local: 21_600 },
    continueAfterFailure: true,
  },
};

export type NightlySuite = {
  /** What the suite is for, in the nightly verdict. */
  readonly summary: string;
  /** Turbo task ids, run through `turbo-ci-run.ts` like every gate task. */
  readonly tasks: readonly string[];
  /**
   * One runner's compute budget: its run is killed here, and no task of it
   * has a tighter one. Its workflow step's `timeout-minutes` stays above
   * this, and the job's stays at most {@link NIGHTLY_JOB_MINUTES}.
   */
  readonly deadlineSeconds: number;
  /**
   * Runners the suite spreads over: its job's matrix. With more than one,
   * every task takes its share of the work from the runner's place in the
   * matrix (`NIGHTLY_SHARD=<k>/<n>`; the Storybook tasks read
   * `STORYBOOK_SHARD`), so the shards together run the whole suite once.
   * The browser suite is the exception: its runners take the night's turn
   * of its partitions (`apps/product-ts/scripts/stack-shards.ts`).
   */
  readonly shards: number;
  /**
   * What one night verifies: the whole suite, or a rotating turn of its
   * partitions, which the nightly verdict states beside a pass.
   */
  readonly nightlyScope: 'whole' | 'rotating';
};

const STORYBOOK_MCP_TEST = '@pkgs/ui-root-harness-ts#storybook:mcp:test';

/**
 * Suites the nightly profile runs. Each suite is one logical group in the
 * verdict and one `verify-nightly:<name>` argument to
 * `turbo-ci-run.ts`; `verify-profile.test.ts` holds the two in step.
 */
export const NIGHTLY_SUITES = {
  random: {
    summary:
      'Randomized hunting: fresh-seed property runs and the determinism fuzz',
    // About 77 minutes of one-file-at-a-time work (Verify Nightly run
    // 45595122814): each of four runners takes every fourth file.
    tasks: ['//#task:test:pbt:random', '@apps/product-ts#test:fuzz'],
    deadlineSeconds: SHARD_DEADLINE_SECONDS,
    shards: 4,
    nightlyScope: 'whole',
  },
  browser: {
    summary:
      'Every spec suite in real browsers against a booted localhost stack, four rotating partitions a night',
    tasks: ['@apps/product-ts#test:stack'],
    deadlineSeconds: SHARD_DEADLINE_SECONDS,
    // Each runner takes tonight's turn of the 24-minute partitions
    // `apps/product-ts/scripts/stack-shards.ts` plans.
    shards: 4,
    nightlyScope: 'rotating',
  },
  visual: {
    summary: 'Every Storybook story rendered and tested in a real browser',
    tasks: ['@pkgs/ui-root-harness-ts#storybook:partition', STORYBOOK_MCP_TEST],
    deadlineSeconds: SHARD_DEADLINE_SECONDS,
    shards: 8,
    nightlyScope: 'whole',
  },
  coverage: {
    summary:
      'Line and assertion coverage of the unit suites, and the scripted mutants they must kill',
    tasks: [
      '//#task:verify:coverage',
      '@pkgs/db-indexes-root-shared-ts#mutants',
    ],
    deadlineSeconds: SHARD_DEADLINE_SECONDS,
    shards: 1,
    nightlyScope: 'whole',
  },
  performance: {
    summary: 'Hot-path benchmarks',
    tasks: [
      '@pkgs/room-root-harness-ts#bench',
      '@pkgs/sync-engine-harness-ts#bench',
      '@libs/pong-harness-ts#bench',
      '@pkgs/sql-root-shared-ts#perf',
    ],
    deadlineSeconds: 1800,
    shards: 1,
    nightlyScope: 'whole',
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
  gateTasks: readonly string[],
  storybookShard?: string
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
  if (suite === 'visual' && storybookShard && !storybookShard.startsWith('1/'))
    return NIGHTLY_SUITES.visual.tasks.filter(
      (task) => task !== STORYBOOK_MCP_TEST
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

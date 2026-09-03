import type { Host, Ports } from '../host/types';
import { fingerprint } from '../kernel/fingerprint';
import type { JsonValue } from '../kernel/json';
import { createReplayingRng, createRng } from '../kernel/rng';
import type { System } from '../system/define-system';
import type { Action, Property } from '../system/effect';
import type { Gen } from '../system/gen';
import type { Choice, Repro } from '../system/repro';
import { parseRepro, REPRO_VERSION } from '../system/repro';
import { closeMonitors } from './checkpoint';
import { getRunInternal, script } from './script';
import { type Walk, walk } from './walk';

export class ExploreFailedError extends Error {
  readonly report: Report;
  constructor(report: Report) {
    super(
      `ExploreFailedError: ${report.failures.length} failure(s)${
        report.vacuity.length > 0
          ? `; vacuity: ${report.vacuity.join(',')}`
          : ''
      }`
    );
    this.name = 'ExploreFailedError';
    this.report = report;
  }
}

export type Report = {
  readonly ok: boolean;
  readonly episodes: number;
  readonly failures: readonly {
    readonly seed: number;
    readonly repro: Repro;
    readonly error: string;
  }[];
  readonly vacuity: readonly string[];
  readonly coverage: {
    readonly states: number;
    readonly actions: Readonly<Record<string, number>>;
  };
};

export type ExploreOptions<S, K = void> = {
  readonly host?: Host<Ports>;
  readonly properties: readonly Property<S>[];
  readonly actions: readonly Action<S, []>[];
  readonly seed?: number;
  /** Fixed knobs or a Gen that draws per episode. */
  readonly knobs?: [K] extends [void] ? undefined : K | Gen<K>;
  readonly episodes?: number;
  readonly steps?: number;
  readonly shrink?: boolean;
  readonly budgetMs?: number;
  readonly stopOnViolation?: boolean;
};

function campaignSeed(opts: ExploreOptions<unknown, unknown>): number {
  if (opts.seed !== undefined) return opts.seed;
  const env =
    typeof process !== 'undefined' ? process.env['PBT_SEED'] : undefined;
  if (env !== undefined && env !== '') return Number(env);
  // Pinned default — matches @pkgs/pbt FC_SEED policy (no wall entropy).
  return 424242;
}

function resolveKnobs<K>(
  knobs: K | Gen<K> | undefined,
  rng: ReturnType<typeof createRng>
): K | undefined {
  if (knobs === undefined) return undefined;
  if (typeof knobs === 'function') {
    return (knobs as Gen<K>)(rng);
  }
  return knobs;
}

type EpisodeAcc = {
  readonly failures: Report['failures'][number][];
  readonly obligationMisses: Map<string, number>;
  readonly allActions: Record<string, number>;
  readonly allStates: Set<string>;
};

function mergeCoverage(acc: EpisodeAcc, w: Walk): void {
  for (const [k, v] of Object.entries(w.coverage.actions)) {
    acc.allActions[k] = (acc.allActions[k] ?? 0) + v;
  }
  for (const s of w.coverage.states) acc.allStates.add(s);
}

function recordEndViolations(args: {
  readonly acc: EpisodeAcc;
  readonly endViolations: readonly {
    property: string;
    at: number | 'end';
    message: string;
  }[];
  readonly epSeed: number;
  readonly w: Walk;
  readonly systemName: string;
}): void {
  for (const v of args.endViolations) {
    if (v.at === 'end') {
      args.acc.obligationMisses.set(
        v.property,
        (args.acc.obligationMisses.get(v.property) ?? 0) + 1
      );
      continue;
    }
    args.acc.failures.push({
      seed: args.epSeed,
      repro: {
        version: REPRO_VERSION,
        seed: args.epSeed,
        system: args.w.system,
        knobs: args.w.knobs,
        choices: args.w.choices,
        meta: { system: args.systemName },
      },
      error: v.message,
    });
  }
}

async function runEpisode<S, K>(args: {
  readonly system: System<S, K>;
  readonly opts: ExploreOptions<S, K>;
  readonly epSeed: number;
  readonly steps: number;
  readonly acc: EpisodeAcc;
  readonly episodeRng: ReturnType<typeof createRng>;
}): Promise<'ok' | 'fail'> {
  const { system, opts, epSeed, steps, acc } = args;
  let run;
  const knobs = resolveKnobs(opts.knobs, args.episodeRng);
  try {
    run = await script(system, {
      seed: epSeed,
      ...(opts.host !== undefined ? { host: opts.host } : {}),
      ...(knobs !== undefined ? { knobs } : {}),
      properties: opts.properties,
    } as Parameters<typeof script<S, K>>[1]);
    const w = await walk(run, {
      actions: opts.actions,
      steps,
      ...(opts.budgetMs !== undefined ? { budgetMs: opts.budgetMs } : {}),
      stopOnViolation: opts.stopOnViolation ?? true,
    });

    mergeCoverage(acc, w);
    const endViolations = await closeMonitors(getRunInternal(run).monitors);
    await run[Symbol.asyncDispose]().catch(() => {});
    recordEndViolations({
      acc,
      endViolations,
      epSeed,
      w,
      systemName: system.name,
    });

    if (w.violations.length > 0) {
      let repro: Repro = {
        version: REPRO_VERSION,
        seed: epSeed,
        system: w.system,
        knobs: w.knobs,
        choices: w.choices,
        meta: { system: system.name },
      };
      if (opts.shrink !== false) {
        repro = await shrinkRepro(system, opts, repro);
      }
      acc.failures.push({
        seed: epSeed,
        repro,
        error: w.violations[0]!.error,
      });
      return 'fail';
    }
    return 'ok';
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    acc.failures.push({
      seed: epSeed,
      repro: {
        version: REPRO_VERSION,
        seed: epSeed,
        system: [],
        knobs: knobs ?? null,
        choices: [],
        meta: { system: system.name },
      },
      error: msg,
    });
    if (run !== undefined) {
      await run[Symbol.asyncDispose]().catch(() => {});
    }
    return 'fail';
  }
}

export async function explore<S, K = void>(
  system: System<S, K>,
  opts: ExploreOptions<S, K>
): Promise<Report> {
  const episodes = opts.episodes ?? 20;
  const steps = opts.steps ?? 40;
  const seed = campaignSeed(opts as ExploreOptions<unknown, unknown>);
  const rng = createRng(seed);
  const acc: EpisodeAcc = {
    failures: [],
    obligationMisses: new Map(),
    allActions: {},
    allStates: new Set(),
  };
  for (const p of opts.properties) {
    acc.obligationMisses.set(p.name, 0);
  }

  for (let ep = 0; ep < episodes; ep++) {
    const epSeed = Math.floor(rng.next() * 1_000_000_000);
    const status = await runEpisode({
      system,
      opts,
      epSeed,
      steps,
      acc,
      episodeRng: createRng(`${String(seed)}:ep:${ep}`),
    });
    if (status === 'fail') break;
  }

  const vacuity = [...acc.obligationMisses.entries()]
    .filter(([, n]) => n === episodes)
    .map(([name]) => name);

  const report: Report = {
    ok: acc.failures.length === 0 && vacuity.length === 0,
    episodes,
    failures: acc.failures,
    vacuity,
    coverage: { states: acc.allStates.size, actions: acc.allActions },
  };

  if (!report.ok) throw new ExploreFailedError(report);
  return report;
}

async function deltaDebugChoices(
  system: System<unknown, unknown>,
  opts: ExploreOptions<unknown, unknown>,
  repro: Repro,
  choices: Choice[]
): Promise<Choice[]> {
  let cur = choices;
  let changed = true;
  while (changed && cur.length > 1) {
    changed = false;
    const mid = Math.ceil(cur.length / 2);
    for (const part of [cur.slice(0, mid), cur.slice(mid)]) {
      if (part.length === 0 || part.length === cur.length) continue;
      if (await fails(system, opts, { ...repro, choices: part })) {
        cur = part;
        changed = true;
        break;
      }
    }
  }
  return cur;
}

async function minifyFloat(
  tryFail: (v: number) => Promise<boolean>,
  start: number
): Promise<number> {
  let lo = 0;
  let hi = start;
  let best = start;
  while (hi - lo > 1e-6 && hi > 0) {
    const mid = (lo + hi) / 2;
    if (await tryFail(mid)) {
      hi = mid;
      best = mid;
    } else {
      lo = mid;
    }
  }
  return best;
}

async function shrinkRepro<S, K>(
  system: System<S, K>,
  opts: ExploreOptions<S, K>,
  repro: Repro
): Promise<Repro> {
  const sys = system as System<unknown, unknown>;
  const o = opts as ExploreOptions<unknown, unknown>;
  const choices = await deltaDebugChoices(sys, o, repro, repro.choices.slice());

  const systemDraws = [...repro.system];
  for (let i = 0; i < systemDraws.length; i++) {
    systemDraws[i] = await minifyFloat(async (mid) => {
      const next = systemDraws.slice();
      next[i] = mid;
      return fails(sys, o, { ...repro, system: next, choices });
    }, systemDraws[i]!);
  }

  const shrunkChoices: Choice[] = choices.map((c) => ({
    action: c.action,
    draws: [...c.draws],
    args: [...c.args],
  }));
  for (const c of shrunkChoices) {
    const draws = c.draws as number[];
    for (let i = 0; i < draws.length; i++) {
      draws[i] = await minifyFloat(async (mid) => {
        const trial = draws.slice();
        trial[i] = mid;
        const trialChoices = shrunkChoices.map((x) =>
          x === c ? { action: c.action, draws: trial, args: c.args } : x
        );
        return fails(sys, o, {
          ...repro,
          system: systemDraws,
          choices: trialChoices,
        });
      }, draws[i]!);
    }
  }

  return { ...repro, system: systemDraws, choices: shrunkChoices };
}

async function fails<S, K>(
  system: System<S, K>,
  opts: ExploreOptions<S, K>,
  repro: Repro
): Promise<boolean> {
  try {
    const r = await replay(system, repro, {
      ...(opts.host !== undefined ? { host: opts.host } : {}),
      properties: opts.properties,
      actions: opts.actions,
    });
    return !r.ok;
  } catch {
    return true;
  }
}

export type ReplayOptions<S> = {
  readonly host?: Host<Ports>;
  readonly properties?: readonly Property<S>[];
  readonly actions: readonly Action<S, []>[];
};

function toRepro<S, K>(
  system: System<S, K>,
  input: Repro | Walk | string
): Repro {
  if (typeof input === 'string') return parseRepro(input);
  if ('version' in input) return input as Repro;
  return {
    version: REPRO_VERSION,
    seed: 0,
    system: (input as Walk).system,
    knobs: (input as Walk).knobs,
    choices: (input as Walk).choices,
    meta: { system: system.name },
  };
}

async function replayChoice<S>(
  run: Awaited<ReturnType<typeof script<S, unknown>>>,
  action: Action<S, unknown[]>,
  choice: Choice
): Promise<void> {
  if (choice.args.length > 0) {
    await run.apply(action, ...choice.args);
    return;
  }
  if (choice.draws.length === 0) {
    await run.apply(action as Action<S, []>);
    return;
  }
  const internal = getRunInternal(run);
  const replayRng = createReplayingRng(choice.draws);
  const origRng = internal.rng;
  internal.rng = replayRng;
  try {
    await run.apply(action as Action<S, []>);
  } finally {
    internal.rng = origRng;
  }
}

export async function replay<S, K = void>(
  system: System<S, K>,
  input: Repro | Walk | string,
  opts: ReplayOptions<S>
): Promise<Report> {
  const repro = toRepro(system, input);
  const actionByName = new Map(
    opts.actions.map((a) => [a.name, a as Action<S, unknown[]>])
  );

  const run = await script(system, {
    seed: repro.seed,
    ...(opts.host !== undefined ? { host: opts.host } : {}),
    ...(repro.knobs !== undefined && repro.knobs !== null
      ? { knobs: repro.knobs as K }
      : {}),
    properties: opts.properties ?? [],
  } as Parameters<typeof script<S, K>>[1]);

  const failures: Report['failures'][number][] = [];
  try {
    for (const choice of repro.choices) {
      const action = actionByName.get(choice.action);
      if (action === undefined) {
        throw new Error(`replay: unknown action '${choice.action}'`);
      }
      const internal = getRunInternal(run);
      const before = fingerprint(
        Object.fromEntries(internal.memo) as JsonValue
      );
      await replayChoice(run, action, choice);
      const after = fingerprint(Object.fromEntries(internal.memo) as JsonValue);
      void before;
      void after;
    }
  } catch (e) {
    failures.push({
      seed: typeof repro.seed === 'number' ? repro.seed : 0,
      repro,
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    await run[Symbol.asyncDispose]().catch(() => {});
  }

  return {
    ok: failures.length === 0,
    episodes: 1,
    failures,
    vacuity: [],
    coverage: { states: 0, actions: {} },
  };
}

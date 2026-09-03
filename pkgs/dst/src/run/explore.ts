import type { Host, Ports } from '../host/types';
import { createRng } from '../kernel/rng';
import type { System } from '../system/define-system';
import type { Action, CatalogAction, CatalogProperty } from '../system/effect';
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
  readonly properties: readonly CatalogProperty<S>[];
  readonly actions: readonly CatalogAction<S>[];
  readonly seed?: number;
  /** Fixed knobs or a Gen that draws per episode. */
  readonly knobs?: [K] extends [void] ? undefined : K | Gen<K>;
  readonly episodes?: number;
  readonly steps?: number;
  readonly shrink?: boolean;
  readonly budgetMs?: number;
  readonly stopOnViolation?: boolean;
  readonly time?: {
    readonly weight: number;
    readonly minMs: number;
    readonly maxMs: number;
  };
};

function campaignSeed(opts: ExploreOptions<unknown, unknown>): number {
  if (opts.seed !== undefined) return opts.seed;
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
      ...(opts.time !== undefined ? { time: opts.time } : {}),
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

function minifyJsonValue(v: unknown): unknown {
  if (typeof v === 'number') return 0;
  if (typeof v === 'string') return '';
  if (typeof v === 'boolean') return false;
  if (Array.isArray(v)) return [];
  if (v !== null && typeof v === 'object') return {};
  return v;
}

async function shrinkRepro<S, K>(
  system: System<S, K>,
  opts: ExploreOptions<S, K>,
  repro: Repro
): Promise<Repro> {
  const sys = system as System<unknown, unknown>;
  const o = opts as ExploreOptions<unknown, unknown>;
  const choices = await deltaDebugChoices(sys, o, repro, repro.choices.slice());

  let knobs = repro.knobs;
  if (knobs !== null && typeof knobs === 'object' && !Array.isArray(knobs)) {
    const obj = { ...(knobs as Record<string, unknown>) };
    for (const key of Object.keys(obj)) {
      const trial = { ...obj, [key]: minifyJsonValue(obj[key]) };
      if (await fails(sys, o, { ...repro, knobs: trial, choices })) {
        obj[key] = trial[key];
      }
    }
    knobs = obj;
  }

  const shrunkChoices: Choice[] = [];
  for (const c of choices) {
    const args = c.args.map((a) => a);
    for (let i = 0; i < args.length; i++) {
      const trial = args.slice();
      trial[i] = minifyJsonValue(args[i]);
      const trialChoices = [
        ...shrunkChoices,
        { action: c.action, args: trial },
        ...choices.slice(shrunkChoices.length + 1),
      ];
      if (
        await fails(sys, o, {
          ...repro,
          knobs,
          choices: trialChoices,
        })
      ) {
        args[i] = trial[i];
      }
    }
    shrunkChoices.push({ action: c.action, args });
  }

  return { ...repro, knobs, choices: shrunkChoices };
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
  readonly properties?: readonly CatalogProperty<S>[];
  readonly actions: readonly CatalogAction<S>[];
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
    knobs: (input as Walk).knobs,
    choices: (input as Walk).choices,
    meta: { system: system.name },
  };
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
      if (choice.action === 'elapse') {
        const ms = Number(choice.args[0] ?? 0);
        await run.elapse(ms);
        continue;
      }
      const action = actionByName.get(choice.action);
      if (action === undefined) {
        throw new Error(`replay: unknown action '${choice.action}'`);
      }
      await run.apply(action, ...(choice.args as never[]));
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

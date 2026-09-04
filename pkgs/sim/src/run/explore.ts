import { createRng } from '../internals/rng';
import type { Action, CatalogAction, CatalogProperty } from '../system/effect';
import type { Gen } from '../system/gen';
import type { Recording, Step } from '../system/recording';
import { parseRecording, RECORDING_VERSION } from '../system/recording';
import {
  type ActionSlice,
  getSystemRegistry,
  resolveActions,
  type SystemCore as System,
} from '../system/registry';
import { closeMonitors } from './checkpoint';
import { type RandomActionsReport, randomActions } from './random-actions';
import { getRunInternal, run } from './run';

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
    readonly repro: Recording;
    readonly error: string;
  }[];
  readonly vacuity: readonly string[];
  readonly coverage: {
    readonly states: number;
    readonly actions: Readonly<Record<string, number>>;
  };
};

export type ExploreOptions<S, Args = void> = {
  /** Registered host name. Omit → system default. */
  readonly runtime?: string;
  /**
   * Slice of the walk: registered action names and/or action objects.
   * Default: every registered action with `pool !== false`.
   */
  readonly actions?: ActionSlice<S>;
  readonly seed?: number;
  /** Fixed args, Partial overlay, or a Gen that draws per episode. */
  readonly args?: [Args] extends [void]
    ? undefined
    : Args | Partial<Args> | Gen<Args>;
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

function resolveEpisodeArgs<Args>(
  system: System<unknown, Args>,
  opts: ExploreOptions<unknown, Args>,
  rng: ReturnType<typeof createRng>
): Args {
  const overlay = opts.args;
  if (typeof overlay === 'function') {
    return (overlay as Gen<Args>)(rng);
  }
  if (system.sample !== undefined && overlay === undefined) {
    return system.sample()(rng);
  }
  if (
    system.args !== undefined &&
    overlay !== undefined &&
    typeof system.args === 'object' &&
    system.args !== null &&
    !Array.isArray(system.args)
  ) {
    return {
      ...(system.args as Record<string, unknown>),
      ...(overlay as Record<string, unknown>),
    } as Args;
  }
  if (overlay !== undefined) return overlay as Args;
  if (system.args !== undefined) return system.args;
  return undefined as Args;
}

type EpisodeAcc = {
  readonly failures: Report['failures'][number][];
  readonly obligationMisses: Map<string, number>;
  readonly allActions: Record<string, number>;
  readonly allStates: Set<string>;
};

function mergeCoverage(acc: EpisodeAcc, w: RandomActionsReport): void {
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
  readonly w: RandomActionsReport;
  readonly systemName: string;
  readonly runtimeName: string;
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
        version: RECORDING_VERSION,
        seed: args.epSeed,
        args: args.w.args,
        steps: args.w.steps,
        meta: { system: args.systemName, runtime: args.runtimeName },
      },
      error: v.message,
    });
  }
}

async function scriptEpisode<S, Args>(args: {
  readonly system: System<S, Args>;
  readonly opts: ExploreOptions<S, Args>;
  readonly epSeed: number;
  readonly steps: number;
  readonly acc: EpisodeAcc;
  readonly episodeRng: ReturnType<typeof createRng>;
  readonly runtimeName: string;
  readonly actions: readonly CatalogAction<S>[];
}): Promise<'ok' | 'fail'> {
  const { system, opts, epSeed, steps, acc } = args;
  let s;
  const systemArgs = resolveEpisodeArgs(
    system as System<unknown, Args>,
    opts as ExploreOptions<unknown, Args>,
    args.episodeRng
  );
  try {
    s = await run(system, {
      seed: epSeed,
      runtime: args.runtimeName,
      ...(systemArgs !== undefined ? { args: systemArgs as never } : {}),
    } as Parameters<typeof run<S, Args>>[1]);
    const w = await randomActions(s, {
      actions: args.actions,
      steps,
      ...(opts.budgetMs !== undefined ? { budgetMs: opts.budgetMs } : {}),
      ...(opts.time !== undefined ? { time: opts.time } : {}),
      stopOnViolation: opts.stopOnViolation ?? true,
    });

    mergeCoverage(acc, w);
    const endViolations = await closeMonitors(getRunInternal(s).monitors);
    await s[Symbol.asyncDispose]().catch(() => {});
    recordEndViolations({
      acc,
      endViolations,
      epSeed,
      w,
      systemName: system.name,
      runtimeName: args.runtimeName,
    });

    if (w.violations.length > 0) {
      let repro: Recording = {
        version: RECORDING_VERSION,
        seed: epSeed,
        args: w.args,
        steps: w.steps,
        meta: { system: system.name, runtime: args.runtimeName },
      };
      const error = w.violations[0]!.error;
      if (opts.shrink !== false) {
        repro = await shrinkRepro(
          {
            system: system as System<unknown, unknown>,
            opts: opts as ExploreOptions<unknown, unknown>,
            actions: args.actions as readonly CatalogAction<unknown>[],
            error,
          },
          repro
        );
      }
      acc.failures.push({ seed: epSeed, repro, error });
      return 'fail';
    }
    return 'ok';
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    acc.failures.push({
      seed: epSeed,
      repro: {
        version: RECORDING_VERSION,
        seed: epSeed,
        args: systemArgs ?? null,
        steps: [],
        meta: { system: system.name, runtime: args.runtimeName },
      },
      error: msg,
    });
    if (s !== undefined) {
      await s[Symbol.asyncDispose]().catch(() => {});
    }
    return 'fail';
  }
}

/** Package-internal — preferred entry is `system.explore`. */
export async function explore<S, Args = void>(
  system: System<S, Args>,
  opts: ExploreOptions<S, Args> = {}
): Promise<Report> {
  const episodes = opts.episodes ?? 20;
  const steps = opts.steps ?? 40;
  const seed = campaignSeed(opts as ExploreOptions<unknown, unknown>);
  const rng = createRng(seed);
  const registry = getSystemRegistry(system as System<S, unknown>);
  const runtimeName = opts.runtime ?? registry.defaultRuntimeName;
  if (runtimeName === undefined) {
    throw new Error(
      `explore: system '${system.name}' has no default runtime (register with system.runtime)`
    );
  }
  const properties = registry.properties as readonly CatalogProperty<S>[];
  const actions = resolveActions(
    system as System<S, unknown>,
    opts.actions
  ) as readonly CatalogAction<S>[];

  const acc: EpisodeAcc = {
    failures: [],
    obligationMisses: new Map(),
    allActions: {},
    allStates: new Set(),
  };
  for (const p of properties) {
    acc.obligationMisses.set(p.name, 0);
  }

  for (let ep = 0; ep < episodes; ep++) {
    const epSeed = Math.floor(rng.next() * 1_000_000_000);
    const status = await scriptEpisode({
      system,
      opts,
      epSeed,
      steps,
      acc,
      episodeRng: createRng(`${String(seed)}:ep:${ep}`),
      runtimeName,
      actions,
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

/** What every shrink trial replays against: system, host, slice, and the failure to match. */
type ShrinkCtx = {
  readonly system: System<unknown, unknown>;
  readonly opts: ExploreOptions<unknown, unknown>;
  readonly actions: readonly CatalogAction<unknown>[];
  readonly error: string;
};

async function deltaDebugSteps(
  ctx: ShrinkCtx,
  repro: Recording,
  steps: Step[]
): Promise<Step[]> {
  let cur = steps;
  let changed = true;
  while (changed && cur.length > 1) {
    changed = false;
    const mid = Math.ceil(cur.length / 2);
    for (const part of [cur.slice(0, mid), cur.slice(mid)]) {
      if (part.length === 0 || part.length === cur.length) continue;
      if (await fails(ctx, { ...repro, steps: part })) {
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

async function shrinkRepro(
  ctx: ShrinkCtx,
  repro: Recording
): Promise<Recording> {
  const steps = await deltaDebugSteps(ctx, repro, repro.steps.slice());

  let systemArgs = repro.args;
  if (
    systemArgs !== null &&
    typeof systemArgs === 'object' &&
    !Array.isArray(systemArgs)
  ) {
    const obj = { ...(systemArgs as Record<string, unknown>) };
    for (const key of Object.keys(obj)) {
      const trial = { ...obj, [key]: minifyJsonValue(obj[key]) };
      if (await fails(ctx, { ...repro, args: trial, steps })) {
        obj[key] = trial[key];
      }
    }
    systemArgs = obj;
  }

  const shrunkSteps: Step[] = [];
  for (const c of steps) {
    const stepArgs = c.args.map((a) => a);
    for (let i = 0; i < stepArgs.length; i++) {
      const trial = stepArgs.slice();
      trial[i] = minifyJsonValue(stepArgs[i]);
      const trialSteps = [
        ...shrunkSteps,
        { action: c.action, args: trial },
        ...steps.slice(shrunkSteps.length + 1),
      ];
      if (await fails(ctx, { ...repro, args: systemArgs, steps: trialSteps })) {
        stepArgs[i] = trial[i];
      }
    }
    shrunkSteps.push({ action: c.action, args: stepArgs });
  }

  return { ...repro, args: systemArgs, steps: shrunkSteps };
}

const PROPERTY_VIOLATION_PREFIX = /^PropertyViolation: ([^ ]+) at /;

/**
 * A shrink candidate only counts when it reproduces the *same* failure: the
 * same property for a `PropertyViolation`, or any failure for a thrown error.
 * Otherwise minified args (empty ids, zero clients) "fail" for unrelated
 * reasons and the repro degenerates.
 */
function sameFailure(original: string, candidate: string): boolean {
  const property = PROPERTY_VIOLATION_PREFIX.exec(original)?.[1];
  if (property === undefined) return true;
  return PROPERTY_VIOLATION_PREFIX.exec(candidate)?.[1] === property;
}

async function fails(ctx: ShrinkCtx, repro: Recording): Promise<boolean> {
  try {
    const r = await replay(ctx.system, repro, {
      ...(ctx.opts.runtime !== undefined ? { runtime: ctx.opts.runtime } : {}),
      actions: ctx.actions,
    });
    if (r.ok) return false;
    return r.failures.some((f) => sameFailure(ctx.error, f.error));
  } catch {
    return false;
  }
}

export type ReplayOptions<S> = {
  readonly runtime?: string;
  /** Slice to dispatch from (names or objects). Default: every registered action. */
  readonly actions?: ActionSlice<S>;
};

function toRepro<S, Args>(
  system: System<S, Args>,
  input: Recording | RandomActionsReport | string
): Recording {
  if (typeof input === 'string') return parseRecording(input);
  if ('version' in input) return input as Recording;
  return {
    version: RECORDING_VERSION,
    seed: 0,
    args: (input as RandomActionsReport).args,
    steps: (input as RandomActionsReport).steps,
    meta: { system: system.name },
  };
}

/** Package-internal — preferred entry is `system.replay`. */
export async function replay<S, Args = void>(
  system: System<S, Args>,
  input: Recording | RandomActionsReport | string,
  opts: ReplayOptions<S> = {}
): Promise<Report> {
  const repro = toRepro(system, input);
  const registry = getSystemRegistry(system as System<S, unknown>);
  const actions =
    opts.actions === undefined
      ? (registry.actions as readonly CatalogAction<S>[])
      : (resolveActions(
          system as System<S, unknown>,
          opts.actions
        ) as readonly CatalogAction<S>[]);
  const runtimeName =
    opts.runtime ?? repro.meta.runtime ?? registry.defaultRuntimeName;
  if (runtimeName === undefined) {
    throw new Error(
      `replay: system '${system.name}' has no default runtime (register with system.runtime)`
    );
  }

  const actionByName = new Map(
    actions.map((a) => [a.name, a as Action<S, unknown[]>])
  );

  const s = await run(system, {
    seed: repro.seed,
    runtime: runtimeName,
    ...(repro.args !== undefined && repro.args !== null
      ? { args: repro.args as never }
      : {}),
  } as Parameters<typeof run<S, Args>>[1]);

  const failures: Report['failures'][number][] = [];
  try {
    for (const step of repro.steps) {
      if (step.action === 'elapse') {
        const ms = Number(step.args[0] ?? 0);
        await s.advanceTime(ms);
        continue;
      }
      const action = actionByName.get(step.action);
      if (action === undefined) {
        throw new Error(`replay: unknown action '${step.action}'`);
      }
      await s.apply(action, ...(step.args as never[]));
    }
  } catch (e) {
    failures.push({
      seed: typeof repro.seed === 'number' ? repro.seed : 0,
      repro,
      error: e instanceof Error ? e.message : String(e),
    });
  } finally {
    await s[Symbol.asyncDispose]().catch(() => {});
  }

  return {
    ok: failures.length === 0,
    episodes: 1,
    failures,
    vacuity: [],
    coverage: { states: 0, actions: {} },
  };
}

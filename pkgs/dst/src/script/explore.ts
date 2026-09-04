import { createRng } from '../kernel/rng';
import {
  getSystemRegistry,
  poolActions,
  type System,
} from '../system/define-system';
import type { Action, CatalogAction, CatalogProperty } from '../system/effect';
import type { Gen } from '../system/gen';
import type { Choice, Repro } from '../system/repro';
import { parseRepro, REPRO_VERSION } from '../system/repro';
import { closeMonitors } from './checkpoint';
import { getScriptInternal, script } from './script';
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

export type ExploreOptions<S, Args = void> = {
  /** Registered host name. Omit → system default. */
  readonly host?: string;
  readonly actions?: readonly CatalogAction<S>[];
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
  if (system.draw !== undefined && overlay === undefined) {
    return system.draw()(rng);
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
  readonly hostName: string;
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
        args: args.w.args,
        choices: args.w.choices,
        meta: { system: args.systemName, host: args.hostName },
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
  readonly hostName: string;
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
    s = await script(system, {
      seed: epSeed,
      host: args.hostName,
      ...(systemArgs !== undefined ? { args: systemArgs as never } : {}),
    } as Parameters<typeof script<S, Args>>[1]);
    const w = await walk(s, {
      actions: args.actions,
      steps,
      ...(opts.budgetMs !== undefined ? { budgetMs: opts.budgetMs } : {}),
      ...(opts.time !== undefined ? { time: opts.time } : {}),
      stopOnViolation: opts.stopOnViolation ?? true,
    });

    mergeCoverage(acc, w);
    const endViolations = await closeMonitors(getScriptInternal(s).monitors);
    await s[Symbol.asyncDispose]().catch(() => {});
    recordEndViolations({
      acc,
      endViolations,
      epSeed,
      w,
      systemName: system.name,
      hostName: args.hostName,
    });

    if (w.violations.length > 0) {
      let repro: Repro = {
        version: REPRO_VERSION,
        seed: epSeed,
        args: w.args,
        choices: w.choices,
        meta: { system: system.name, host: args.hostName },
      };
      if (opts.shrink !== false) {
        repro = await shrinkRepro(system, opts, repro, args.actions);
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
        args: systemArgs ?? null,
        choices: [],
        meta: { system: system.name, host: args.hostName },
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
  const hostName = opts.host ?? registry.defaultHostName;
  if (hostName === undefined) {
    throw new Error(
      `explore: system '${system.name}' has no default host (register with system.host)`
    );
  }
  const properties = registry.properties as readonly CatalogProperty<S>[];
  const actions =
    opts.actions ??
    (poolActions(system as System<S, unknown>) as readonly CatalogAction<S>[]);

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
      hostName,
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

async function deltaDebugChoices(
  system: System<unknown, unknown>,
  opts: ExploreOptions<unknown, unknown>,
  repro: Repro,
  choices: Choice[],
  actions: readonly CatalogAction<unknown>[]
): Promise<Choice[]> {
  let cur = choices;
  let changed = true;
  while (changed && cur.length > 1) {
    changed = false;
    const mid = Math.ceil(cur.length / 2);
    for (const part of [cur.slice(0, mid), cur.slice(mid)]) {
      if (part.length === 0 || part.length === cur.length) continue;
      if (await fails(system, opts, { ...repro, choices: part }, actions)) {
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

async function shrinkRepro<S, Args>(
  system: System<S, Args>,
  opts: ExploreOptions<S, Args>,
  repro: Repro,
  actions: readonly CatalogAction<S>[]
): Promise<Repro> {
  const sys = system as System<unknown, unknown>;
  const o = opts as ExploreOptions<unknown, unknown>;
  const acts = actions as readonly CatalogAction<unknown>[];
  const choices = await deltaDebugChoices(
    sys,
    o,
    repro,
    repro.choices.slice(),
    acts
  );

  let systemArgs = repro.args;
  if (
    systemArgs !== null &&
    typeof systemArgs === 'object' &&
    !Array.isArray(systemArgs)
  ) {
    const obj = { ...(systemArgs as Record<string, unknown>) };
    for (const key of Object.keys(obj)) {
      const trial = { ...obj, [key]: minifyJsonValue(obj[key]) };
      if (await fails(sys, o, { ...repro, args: trial, choices }, acts)) {
        obj[key] = trial[key];
      }
    }
    systemArgs = obj;
  }

  const shrunkChoices: Choice[] = [];
  for (const c of choices) {
    const choiceArgs = c.args.map((a) => a);
    for (let i = 0; i < choiceArgs.length; i++) {
      const trial = choiceArgs.slice();
      trial[i] = minifyJsonValue(choiceArgs[i]);
      const trialChoices = [
        ...shrunkChoices,
        { action: c.action, args: trial },
        ...choices.slice(shrunkChoices.length + 1),
      ];
      if (
        await fails(
          sys,
          o,
          {
            ...repro,
            args: systemArgs,
            choices: trialChoices,
          },
          acts
        )
      ) {
        choiceArgs[i] = trial[i];
      }
    }
    shrunkChoices.push({ action: c.action, args: choiceArgs });
  }

  return { ...repro, args: systemArgs, choices: shrunkChoices };
}

async function fails<S, Args>(
  system: System<S, Args>,
  opts: ExploreOptions<S, Args>,
  repro: Repro,
  actions: readonly CatalogAction<S>[]
): Promise<boolean> {
  try {
    const r = await replay(system, repro, {
      ...(opts.host !== undefined ? { host: opts.host } : {}),
      actions,
    });
    return !r.ok;
  } catch {
    return false;
  }
}

export type ReplayOptions<S> = {
  readonly host?: string;
  readonly actions?: readonly CatalogAction<S>[];
};

function toRepro<S, Args>(
  system: System<S, Args>,
  input: Repro | Walk | string
): Repro {
  if (typeof input === 'string') return parseRepro(input);
  if ('version' in input) return input as Repro;
  return {
    version: REPRO_VERSION,
    seed: 0,
    args: (input as Walk).args,
    choices: (input as Walk).choices,
    meta: { system: system.name },
  };
}

/** Package-internal — preferred entry is `system.replay`. */
export async function replay<S, Args = void>(
  system: System<S, Args>,
  input: Repro | Walk | string,
  opts: ReplayOptions<S> = {}
): Promise<Report> {
  const repro = toRepro(system, input);
  const registry = getSystemRegistry(system as System<S, unknown>);
  const actions =
    opts.actions ?? (registry.actions as readonly CatalogAction<S>[]);
  const hostName = opts.host ?? repro.meta.host ?? registry.defaultHostName;
  if (hostName === undefined) {
    throw new Error(
      `replay: system '${system.name}' has no default host (register with system.host)`
    );
  }

  const actionByName = new Map(
    actions.map((a) => [a.name, a as Action<S, unknown[]>])
  );

  const s = await script(system, {
    seed: repro.seed,
    host: hostName,
    ...(repro.args !== undefined && repro.args !== null
      ? { args: repro.args as never }
      : {}),
  } as Parameters<typeof script<S, Args>>[1]);

  const failures: Report['failures'][number][] = [];
  try {
    for (const choice of repro.choices) {
      if (choice.action === 'elapse') {
        const ms = Number(choice.args[0] ?? 0);
        await s.elapse(ms);
        continue;
      }
      const action = actionByName.get(choice.action);
      if (action === undefined) {
        throw new Error(`replay: unknown action '${choice.action}'`);
      }
      await s.apply(action, ...(choice.args as never[]));
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

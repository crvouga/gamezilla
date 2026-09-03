import type { Host, Ports } from '../host/types';
import { fingerprint } from '../kernel/fingerprint';
import type { JsonValue } from '../kernel/json';
import { createRng } from '../kernel/rng';
import { closeMonitors } from '../run/checkpoint';
import { start } from '../run/start';
import { type Walk, walk } from '../run/walk';
import type { System } from '../system/define-system';
import type { Action, Property } from '../system/effect';
import type { Choice, Repro } from '../system/repro';
import { parseRepro, REPRO_VERSION } from '../system/repro';

export class CheckFailedError extends Error {
  readonly report: Report;
  constructor(report: Report) {
    super(
      `CheckFailedError: ${report.failures.length} failure(s)${
        report.vacuity.length > 0
          ? `; vacuity: ${report.vacuity.join(',')}`
          : ''
      }`
    );
    this.name = 'CheckFailedError';
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

export type CheckOptions<S> = {
  readonly host?: Host<Ports>;
  readonly properties: readonly Property<S>[];
  readonly actions: readonly Action<S>[];
  readonly seed?: number;
  readonly draws?: readonly unknown[];
  readonly episodes?: number;
  readonly steps?: number;
  readonly shrink?: boolean;
  readonly budgetMs?: number;
  readonly stopOnViolation?: boolean;
};

function campaignSeed(opts: CheckOptions<unknown>): number {
  if (opts.seed !== undefined) return opts.seed;
  const env =
    typeof process !== 'undefined' ? process.env['PBT_SEED'] : undefined;
  if (env !== undefined && env !== '') return Number(env);
  // Pinned default — matches @pkgs/pbt FC_SEED policy (no wall entropy).
  return 424242;
}

type EpisodeAcc = {
  readonly failures: Report['failures'][number][];
  readonly obligationMisses: Map<string, number>;
  readonly allActions: Record<string, number>;
  readonly allStates: Set<string>;
};

async function runEpisode<S>(args: {
  readonly system: System<S>;
  readonly opts: CheckOptions<S>;
  readonly epSeed: number;
  readonly steps: number;
  readonly acc: EpisodeAcc;
}): Promise<'ok' | 'fail'> {
  const { system, opts, epSeed, steps, acc } = args;
  let run;
  try {
    run = await start(system, {
      seed: epSeed,
      ...(opts.host !== undefined ? { host: opts.host } : {}),
      ...(opts.draws !== undefined ? { draws: opts.draws } : {}),
      properties: opts.properties,
    });
    const w = await walk(run, {
      actions: opts.actions,
      steps,
      ...(opts.budgetMs !== undefined ? { budgetMs: opts.budgetMs } : {}),
      stopOnViolation: opts.stopOnViolation ?? true,
    });

    for (const [k, v] of Object.entries(w.coverage.actions)) {
      acc.allActions[k] = (acc.allActions[k] ?? 0) + v;
    }
    for (const s of w.coverage.states) acc.allStates.add(s);

    const endViolations = await closeMonitors(run._internal.monitors);
    await run[Symbol.asyncDispose]().catch(() => {});

    for (const v of endViolations) {
      if (v.at === 'end') {
        acc.obligationMisses.set(
          v.property,
          (acc.obligationMisses.get(v.property) ?? 0) + 1
        );
      } else {
        acc.failures.push({
          seed: epSeed,
          repro: {
            version: REPRO_VERSION,
            seed: epSeed,
            system: w.system,
            choices: w.choices,
            meta: { system: system.name },
          },
          error: v.message,
        });
      }
    }

    if (w.violations.length > 0) {
      let repro: Repro = {
        version: REPRO_VERSION,
        seed: epSeed,
        system: w.system,
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

export async function check<S>(
  system: System<S>,
  opts: CheckOptions<S>
): Promise<Report> {
  const episodes = opts.episodes ?? 20;
  const steps = opts.steps ?? 40;
  const seed = campaignSeed(opts as CheckOptions<unknown>);
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

  if (!report.ok) throw new CheckFailedError(report);
  return report;
}

async function deltaDebugChoices(
  system: System<unknown>,
  opts: CheckOptions<unknown>,
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

async function shrinkRepro<S>(
  system: System<S>,
  opts: CheckOptions<S>,
  repro: Repro
): Promise<Repro> {
  const sys = system as System<unknown>;
  const o = opts as CheckOptions<unknown>;
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
  }));
  for (const c of shrunkChoices) {
    const draws = c.draws as number[];
    for (let i = 0; i < draws.length; i++) {
      draws[i] = await minifyFloat(async (mid) => {
        const trial = draws.slice();
        trial[i] = mid;
        const trialChoices = shrunkChoices.map((x) =>
          x === c ? { action: c.action, draws: trial } : x
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

async function fails<S>(
  system: System<S>,
  opts: CheckOptions<S>,
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
  readonly actions: readonly Action<S>[];
};

export async function replay<S>(
  system: System<S>,
  input: Repro | Walk | string,
  opts: ReplayOptions<S>
): Promise<Report> {
  const repro: Repro =
    typeof input === 'string'
      ? parseRepro(input)
      : 'version' in input
        ? (input as Repro)
        : {
            version: REPRO_VERSION,
            seed: 0,
            system: (input as Walk).system,
            choices: (input as Walk).choices,
            meta: { system: system.name },
          };

  const actionByName = new Map(opts.actions.map((a) => [a.name, a]));
  const run = await start(system, {
    seed: repro.seed,
    ...(opts.host !== undefined ? { host: opts.host } : {}),
    ...(repro.system.length > 0
      ? {} // system draws replayed via rng — for pinned floats we'd need scripted
      : {}),
    properties: opts.properties ?? [],
  });

  const failures: Report['failures'][number][] = [];
  try {
    for (let i = 0; i < repro.choices.length; i++) {
      const choice = repro.choices[i]!;
      const action = actionByName.get(choice.action);
      if (action === undefined) {
        throw new Error(`replay: unknown action '${choice.action}'`);
      }
      const before = fingerprint(
        Object.fromEntries(run._internal.memo) as JsonValue
      );
      // Replay draws: use replaying rng by applying with recorded floats
      // via a custom path — patch ctx rng
      const { createReplayingRng } = await import('../kernel/rng');
      const replayRng = createReplayingRng(choice.draws);
      const origRng = run._internal.rng;
      (run._internal as unknown as { rng: typeof replayRng }).rng = replayRng;

      await run.apply(action);

      (run._internal as unknown as { rng: typeof origRng }).rng = origRng;

      const after = fingerprint(
        Object.fromEntries(run._internal.memo) as JsonValue
      );
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

import { fingerprint } from './fingerprint';
import type { Rng } from './rng';
import type { AppliedAction } from './effect';
import { ACTION_TAG } from './effect';
import type { Action, CatalogAction } from './effect';
import type { ActionSlice } from './registry';
import { resolveActions } from './registry';
import { checkpoint } from './checkpoint';
import type { ProbeResult } from './probe';
import { probeAll } from './probe';
import { getRunInternal } from './run-types';
import type { RandomActionsOptions, RandomActionsReport, Run, RunInternal } from './run-types';

type Cand<S> = {
  readonly action: Action<S, unknown[]>;
  readonly weight: number;
  readonly kind: 'action' | 'elapse';
  readonly elapseMs?: number;
};

function pickWeighted<T extends { weight: number }>(
  items: readonly T[],
  next: () => number
): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = next() * total;
  for (const item of items) {
    r -= item.weight;
    if (r < 0) return item;
  }
  return items[items.length - 1]!;
}

function normalizeArgs(drawn: unknown): readonly unknown[] {
  if (Array.isArray(drawn)) return drawn;
  return [drawn];
}

function budgetExceeded(
  clockNow: () => number,
  t0: number,
  budgetMs: number | undefined
): boolean {
  if (budgetMs === undefined) return false;
  return clockNow() - t0 > budgetMs;
}

function collectEnabled<S>(
  probed: readonly { action: Action<S, unknown[]>; result: ProbeResult }[],
  time: RandomActionsOptions<S>['time'],
  next: () => number,
  advanceTime: (ms: number) => Promise<void>
): Cand<S>[] {
  const enabled: Cand<S>[] = [];
  for (const { action, result } of probed) {
    if (!result.enabled) continue;
    const r = result as Extract<ProbeResult, { enabled: true }>;
    enabled.push({ action, weight: r.weight, kind: 'action' });
  }
  if (time === undefined || time.weight <= 0) return enabled;
  const span = Math.max(0, time.maxMs - time.minMs);
  const ms = time.minMs + Math.floor(next() * (span + 1));
  enabled.push({
    action: {
      [ACTION_TAG]: true,
      name: 'elapse',
      enabled: () => true,
      weight: () => time.weight,
      args: undefined,
      sample: undefined,
      pool: true,
      describe: undefined,
      report: true,
      act: async () => {
        await advanceTime(ms);
      },
      is: (action): action is AppliedAction<unknown[]> =>
        action !== null && action.name === 'elapse',
    } as Action<S, unknown[]>,
    weight: time.weight,
    kind: 'elapse',
    elapseMs: ms,
  });
  return enabled;
}

async function sampleArgs<S>(
  picked: Cand<S>,
  surface: S,
  fork: (name: string) => Rng,
  count: number
): Promise<readonly unknown[]> {
  if (picked.kind === 'elapse') return [picked.elapseMs!];
  if (picked.action.sample === undefined) return [];
  const gen = await picked.action.sample(surface);
  return normalizeArgs(gen(fork(`args:${picked.action.name}:${count}`)));
}

async function applyPicked<S>(args: {
  readonly internal: RunInternal<S>;
  readonly picked: Cand<S>;
  readonly applyArgs: readonly unknown[];
  readonly actionCounts: Record<string, number>;
  readonly states: Set<string>;
  readonly violations: { error: string }[];
  readonly stopOnViolation: boolean;
}): Promise<'continue' | 'stop'> {
  const { internal, picked, applyArgs } = args;
  internal.step += 1;
  try {
    const result = await checkpoint({
      actionName: picked.action.name,
      applyArgs,
      act: (s, ...a) => picked.action.act(s, ...(a as never[])),
      surface: internal.surface,
      waitForIdle: () => internal.session.waitForIdle(),
      monitors: internal.monitors,
      t: internal.step,
    });
    internal.transitions.push(result.transition);
    internal.steps.push(result.step);
    args.actionCounts[picked.action.name] =
      (args.actionCounts[picked.action.name] ?? 0) + 1;
    args.states.add(fingerprint(result.transition.after as never));
    if (result.violations.length > 0) {
      args.violations.push({ error: result.violations[0]!.message });
      if (args.stopOnViolation) return 'stop';
    }
  } catch (e) {
    // The step that threw is part of the repro — without it `replay` stops one
    // action short and reports a clean run.
    internal.steps.push({ action: picked.action.name, args: applyArgs });
    args.violations.push({
      error: e instanceof Error ? e.message : String(e),
    });
    if (args.stopOnViolation) return 'stop';
  }
  return 'continue';
}

/** Package-internal — preferred entry is `s.randomActions`. */
export async function randomActions<S>(
  s: Run<S>,
  opts: RandomActionsOptions<S> = {}
): Promise<RandomActionsReport> {
  const internal = getRunInternal(s);
  const maxSteps = opts.steps ?? 40;
  const stopOnViolation = opts.stopOnViolation ?? true;
  const walkRng = internal.rng.fork('randomActions');
  const actionCounts: Record<string, number> = {};
  const states = new Set<string>();
  const violations: { error: string }[] = [];
  let count = 0;
  const clockNow = () => internal.session.ports.clock.now();
  const t0 = clockNow();

  const catalog = resolveActions(
    internal.system as never,
    opts.actions as ActionSlice<unknown> | undefined
  ) as readonly CatalogAction<S>[];

  while (count < maxSteps) {
    if (budgetExceeded(clockNow, t0, opts.budgetMs)) break;

    const probed = await probeAll(
      catalog as readonly Action<S, unknown[]>[],
      internal.surface,
      false,
      walkRng
    );
    const enabled = collectEnabled(
      probed,
      opts.time,
      () => walkRng.next(),
      (ms) => internal.session.advanceTime(ms)
    );
    if (enabled.length === 0) break;

    const picked = pickWeighted(enabled, () => walkRng.next());
    const applyArgs = await sampleArgs(
      picked,
      internal.surface,
      (name) => walkRng.fork(name),
      count
    );
    const next = await applyPicked({
      internal,
      picked,
      applyArgs,
      actionCounts,
      states,
      violations,
      stopOnViolation,
    });
    if (next === 'stop') break;
    count += 1;
  }

  return {
    count,
    steps: internal.steps.slice(),
    transitions: internal.transitions.slice(),
    args: internal.args,
    coverage: { states, actions: actionCounts },
    violations,
  };
}

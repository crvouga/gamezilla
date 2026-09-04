import { fingerprint } from '../kernel/fingerprint';
import type { Rng } from '../kernel/rng';
import { poolActions } from '../system/define-system';
import { ACTION_TAG, type Action, type CatalogAction } from '../system/effect';
import type { Choice } from '../system/repro';
import type { Transition } from './checkpoint';
import { checkpoint } from './checkpoint';
import { type ProbeResult, probeAll } from './probe';
import { getScriptInternal, type Script, type ScriptInternal } from './script';

export type WalkOptions<S> = {
  /** Override the registered pool (default: system actions with pool !== false). */
  readonly actions?: readonly CatalogAction<S>[];
  readonly steps?: number;
  readonly budgetMs?: number;
  readonly stopOnViolation?: boolean;
  readonly time?: {
    readonly weight: number;
    readonly minMs: number;
    readonly maxMs: number;
  };
};

export type Walk = {
  readonly steps: number;
  readonly choices: readonly Choice[];
  readonly transitions: readonly Transition[];
  readonly args: unknown;
  readonly coverage: {
    readonly states: ReadonlySet<string>;
    readonly actions: Readonly<Record<string, number>>;
  };
  readonly violations: readonly { readonly error: string }[];
};

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
  time: WalkOptions<S>['time'],
  next: () => number,
  elapse: (ms: number) => Promise<void>
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
      draw: undefined,
      pool: true,
      act: async () => {
        await elapse(ms);
      },
    } as Action<S, unknown[]>,
    weight: time.weight,
    kind: 'elapse',
    elapseMs: ms,
  });
  return enabled;
}

async function drawArgs<S>(
  picked: Cand<S>,
  surface: S,
  fork: (name: string) => Rng,
  steps: number
): Promise<readonly unknown[]> {
  if (picked.kind === 'elapse') return [picked.elapseMs!];
  if (picked.action.draw === undefined) return [];
  const gen = await picked.action.draw(surface);
  return normalizeArgs(gen(fork(`args:${picked.action.name}:${steps}`)));
}

async function applyPicked<S>(args: {
  readonly internal: ScriptInternal<S>;
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
      settle: () => internal.session.settle(),
      monitors: internal.monitors,
      t: internal.step,
    });
    internal.transitions.push(result.transition);
    internal.choices.push(result.choice);
    args.actionCounts[picked.action.name] =
      (args.actionCounts[picked.action.name] ?? 0) + 1;
    args.states.add(fingerprint(result.transition.after as never));
    if (result.violations.length > 0) {
      args.violations.push({ error: result.violations[0]!.message });
      if (args.stopOnViolation) return 'stop';
    }
  } catch (e) {
    args.violations.push({
      error: e instanceof Error ? e.message : String(e),
    });
    if (args.stopOnViolation) return 'stop';
  }
  return 'continue';
}

/** Package-internal — preferred entry is `s.walk`. */
export async function walk<S>(
  s: Script<S>,
  opts: WalkOptions<S> = {}
): Promise<Walk> {
  const internal = getScriptInternal(s);
  const maxSteps = opts.steps ?? 40;
  const stopOnViolation = opts.stopOnViolation ?? true;
  const walkRng = internal.rng.fork('walk');
  const actionCounts: Record<string, number> = {};
  const states = new Set<string>();
  const violations: { error: string }[] = [];
  let steps = 0;
  const clockNow = () => internal.session.ports.clock.now();
  const t0 = clockNow();

  const catalog =
    opts.actions ??
    (poolActions(internal.system) as readonly CatalogAction<S>[]);

  while (steps < maxSteps) {
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
      (ms) => internal.session.elapse(ms)
    );
    if (enabled.length === 0) break;

    const picked = pickWeighted(enabled, () => walkRng.next());
    const applyArgs = await drawArgs(
      picked,
      internal.surface,
      (name) => walkRng.fork(name),
      steps
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
    steps += 1;
  }

  return {
    steps,
    choices: internal.choices.slice(),
    transitions: internal.transitions.slice(),
    args: internal.args,
    coverage: { states, actions: actionCounts },
    violations,
  };
}

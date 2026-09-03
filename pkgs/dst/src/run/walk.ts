import { fingerprint } from '../kernel/fingerprint';
import { ACTION_TAG, type Action, type CatalogAction } from '../system/effect';
import type { Choice } from '../system/repro';
import type { Transition } from './checkpoint';
import { checkpoint } from './checkpoint';
import { type ProbeResult, probeAll } from './probe';
import { getRunInternal, type Run } from './script';

export type WalkOptions<S> = {
  readonly actions: readonly CatalogAction<S>[];
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
  readonly knobs: unknown;
  readonly coverage: {
    readonly states: ReadonlySet<string>;
    readonly actions: Readonly<Record<string, number>>;
  };
  readonly violations: readonly { readonly error: string }[];
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

export async function walk<S>(
  run: Run<S>,
  opts: WalkOptions<S>
): Promise<Walk> {
  const internal = getRunInternal(run);
  const maxSteps = opts.steps ?? 40;
  const stopOnViolation = opts.stopOnViolation ?? true;
  const walkRng = internal.rng.fork('walk');
  const actionCounts: Record<string, number> = {};
  const states = new Set<string>();
  const violations: { error: string }[] = [];
  let steps = 0;
  const t0 =
    typeof performance !== 'undefined' ? performance.now() : Date.now();

  while (steps < maxSteps) {
    if (opts.budgetMs !== undefined) {
      const now =
        typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (now - t0 > opts.budgetMs) break;
    }

    const probed = await probeAll(
      opts.actions as readonly Action<S, unknown[]>[],
      internal.surface,
      false,
      walkRng
    );

    type Cand = {
      readonly action: Action<S, unknown[]>;
      readonly weight: number;
      readonly kind: 'action' | 'elapse';
      readonly elapseMs?: number;
    };
    const enabled: Cand[] = [];
    for (const { action, result } of probed) {
      if (!result.enabled) continue;
      const r = result as Extract<ProbeResult, { enabled: true }>;
      enabled.push({ action, weight: r.weight, kind: 'action' });
    }
    if (opts.time !== undefined && opts.time.weight > 0) {
      const span = Math.max(0, opts.time.maxMs - opts.time.minMs);
      const ms = opts.time.minMs + Math.floor(walkRng.next() * (span + 1));
      enabled.push({
        action: {
          [ACTION_TAG]: true,
          name: 'elapse',
          enabled: () => true,
          weight: () => opts.time!.weight,
          args: undefined,
          act: async () => {
            await internal.session.elapse(ms);
          },
        } as Action<S, unknown[]>,
        weight: opts.time.weight,
        kind: 'elapse',
        elapseMs: ms,
      });
    }

    if (enabled.length === 0) break;

    const picked = pickWeighted(enabled, () => walkRng.next());
    let args: readonly unknown[] = [];
    if (picked.kind === 'elapse') {
      args = [picked.elapseMs!];
    } else if (picked.action.args !== undefined) {
      const gen = await picked.action.args(internal.surface);
      args = normalizeArgs(
        gen(walkRng.fork(`args:${picked.action.name}:${steps}`))
      );
    }

    internal.step += 1;
    try {
      const result = await checkpoint({
        actionName: picked.action.name,
        applyArgs: args,
        act: (s, ...a) => picked.action.act(s, ...(a as never[])),
        surface: internal.surface,
        settle: () => internal.session.settle(),
        monitors: internal.monitors,
        t: internal.step,
      });
      internal.transitions.push(result.transition);
      internal.choices.push(result.choice);
      actionCounts[picked.action.name] =
        (actionCounts[picked.action.name] ?? 0) + 1;
      states.add(fingerprint(result.transition.after as never));
      if (result.violations.length > 0) {
        violations.push({ error: result.violations[0]!.message });
        if (stopOnViolation) break;
      }
    } catch (e) {
      violations.push({
        error: e instanceof Error ? e.message : String(e),
      });
      if (stopOnViolation) break;
    }
    steps += 1;
  }

  return {
    steps,
    choices: internal.choices.slice(),
    transitions: internal.transitions.slice(),
    knobs: internal.knobs,
    coverage: { states, actions: actionCounts },
    violations,
  };
}

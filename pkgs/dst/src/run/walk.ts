import { fingerprint } from '../kernel/fingerprint';
import type { JsonValue } from '../kernel/json';
import type { Rng } from '../kernel/rng';
import type { Action } from '../system/effect';
import type { Choice } from '../system/repro';
import { checkpoint, PropertyViolation, type Transition } from './checkpoint';
import type { DriveContext } from './drive';
import { closeGenerator } from './drive';
import { type ProbeResult, probe } from './probe';
import type { Run } from './start';

export type WalkOptions<S> = {
  readonly actions: readonly Action<S>[];
  readonly steps?: number;
  readonly budgetMs?: number;
  readonly stopOnViolation?: boolean;
};

export type Walk = {
  readonly system: readonly number[];
  readonly transitions: readonly Transition[];
  readonly violations: readonly {
    readonly property: string;
    readonly at: number | 'end';
    readonly error: string;
  }[];
  readonly coverage: {
    readonly states: ReadonlySet<string>;
    readonly actions: Readonly<Record<string, number>>;
  };
  readonly choices: readonly Choice[];
};

type EnabledEntry<S> = {
  readonly action: Action<S>;
  readonly probe: Extract<ProbeResult<S>, { enabled: true }>;
  readonly weight: number;
};

function pickWeighted<T extends { weight: number }>(
  items: readonly T[],
  next: () => number
): T {
  const total = items.reduce((a, b) => a + b.weight, 0);
  let r = next() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1]!;
}

async function probeAll<S>(
  actions: readonly Action<S>[],
  ctx: DriveContext<S>,
  walkRng: Rng,
  steps: number
): Promise<{ action: Action<S>; probe: ProbeResult<S> }[]> {
  const out: { action: Action<S>; probe: ProbeResult<S> }[] = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i]!;
    out.push({
      action,
      probe: await probe(
        action,
        ctx,
        walkRng.fork(`probe:${steps}:${action.name}:${i}`)
      ),
    });
  }
  return out;
}

async function closeUnpicked<S>(
  probes: readonly { probe: ProbeResult<S> }[],
  picked: ProbeResult<S> | undefined
): Promise<void> {
  for (const x of probes) {
    if (!x.probe.enabled) continue;
    if (picked !== undefined && x.probe === picked) continue;
    await closeGenerator(x.probe.body);
    for (const n of x.probe.nested) {
      await closeGenerator(n.body);
    }
  }
}

function recordViolations(
  violations: Walk['violations'][number][],
  items: readonly { property: string; at: number | 'end'; message: string }[]
): void {
  for (const v of items) {
    violations.push({ property: v.property, at: v.at, error: v.message });
  }
}

async function applyPickedStep<S>(args: {
  readonly run: Run<S>;
  readonly picked: EnabledEntry<S>;
  readonly t: number;
  readonly transitions: Transition[];
  readonly choices: Choice[];
  readonly actionCounts: Record<string, number>;
  readonly states: Set<string>;
  readonly violations: Walk['violations'][number][];
  readonly stopOnViolation: boolean | undefined;
}): Promise<'continue' | 'stop'> {
  const internal = args.run._internal;
  try {
    const result = await checkpoint({
      action: args.picked.action,
      probed: args.picked.probe,
      ctx: internal.ctx(),
      monitors: internal.monitors,
      t: args.t,
    });
    args.transitions.push(result.transition);
    args.choices.push(result.choice);
    args.actionCounts[args.picked.action.name] =
      (args.actionCounts[args.picked.action.name] ?? 0) + 1;
    args.states.add(fingerprint(result.transition.after as JsonValue));
    if (result.violations.length > 0) {
      recordViolations(args.violations, result.violations);
      if (args.stopOnViolation) return 'stop';
    }
  } catch (e) {
    if (!(e instanceof PropertyViolation)) throw e;
    recordViolations(args.violations, [e]);
    if (args.stopOnViolation) return 'stop';
  }
  return 'continue';
}

export async function walk<S>(
  run: Run<S>,
  opts: WalkOptions<S>
): Promise<Walk> {
  const internal = run._internal;
  const transitions: Transition[] = [...internal.transitions];
  const choices: Choice[] = [...internal.choices];
  const violations: Walk['violations'][number][] = [];
  const states = new Set<string>();
  const actionCounts: Record<string, number> = {};
  const maxSteps = opts.steps ?? Number.POSITIVE_INFINITY;
  const deadline =
    opts.budgetMs !== undefined
      ? internal.session.ports.clock.now() + opts.budgetMs
      : Number.POSITIVE_INFINITY;
  let steps = 0;
  const walkRng = internal.rng.fork('walk');

  while (steps < maxSteps) {
    if (internal.session.ports.clock.now() >= deadline) break;

    const probes = await probeAll(opts.actions, internal.ctx(), walkRng, steps);
    const enabled: EnabledEntry<S>[] = probes
      .filter(
        (
          x
        ): x is {
          action: Action<S>;
          probe: Extract<ProbeResult<S>, { enabled: true }>;
        } => x.probe.enabled
      )
      .map((e) => ({ ...e, weight: e.probe.weight }));

    if (enabled.length === 0) break;

    const picked = pickWeighted(enabled, () => walkRng.next());
    await closeUnpicked(probes, picked.probe);

    internal.step += 1;
    steps += 1;
    const status = await applyPickedStep({
      run,
      picked,
      t: internal.step,
      transitions,
      choices,
      actionCounts,
      states,
      violations,
      stopOnViolation: opts.stopOnViolation,
    });
    if (status === 'stop') break;
  }

  return {
    system: internal.systemDraws.slice(),
    transitions,
    violations,
    coverage: { states, actions: actionCounts },
    choices,
  };
}

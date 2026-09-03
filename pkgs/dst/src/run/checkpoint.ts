import type { JsonValue } from '../kernel/json';
import type { Action, Observation, Property } from '../system/effect';
import type { Choice } from '../system/repro';
import { closeGenerator, type DriveContext, resolveObservation } from './drive';
import {
  ActionNotEnabled,
  type EnabledProbe,
  finishProbed,
  probe,
} from './probe';

export class PropertyViolation extends Error {
  readonly property: string;
  readonly at: number | 'end';
  override readonly cause: unknown;
  constructor(property: string, at: number | 'end', cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`PropertyViolation: '${property}' at ${String(at)}: ${msg}`);
    this.name = 'PropertyViolation';
    this.property = property;
    this.at = at;
    this.cause = cause;
  }
}

export type Transition = {
  readonly t: number;
  readonly before: Record<string, JsonValue>;
  readonly action: {
    readonly name: string;
    readonly payload: readonly JsonValue[];
  };
  readonly after: Record<string, JsonValue>;
};

export type MonitorState = {
  readonly property: Property<unknown>;
  body:
    | Generator<unknown, void, unknown>
    | AsyncGenerator<unknown, void, unknown>;
  pending: Observation<unknown, JsonValue> | null;
  closed: boolean;
};

function snapshotMemo(memo: Map<string, JsonValue>): Record<string, JsonValue> {
  const out: Record<string, JsonValue> = {};
  for (const [k, v] of memo) out[k] = v;
  return out;
}

async function genNext(
  body:
    | Generator<unknown, void, unknown>
    | AsyncGenerator<unknown, void, unknown>,
  answer: unknown
): Promise<IteratorResult<unknown, void>> {
  if (Symbol.asyncIterator in Object(body)) {
    return (body as AsyncGenerator<unknown, void, unknown>).next(answer);
  }
  return (body as Generator<unknown, void, unknown>).next(answer);
}

/**
 * Advance a monitor to its next Observation yield (or done).
 * Answers the previous pending read with `answer`.
 */
export async function advanceMonitor(
  m: MonitorState,
  answer: JsonValue | undefined,
  at: number | 'end'
): Promise<void> {
  if (m.closed) return;
  try {
    const r = await genNext(m.body, answer);
    if (r.done) {
      m.closed = true;
      m.pending = null;
      return;
    }
    m.pending = r.value as Observation<unknown, JsonValue>;
  } catch (e) {
    m.closed = true;
    throw new PropertyViolation(m.property.name, at, e);
  }
}

export async function resumeMonitors(
  monitors: MonitorState[],
  ctx: DriveContext<unknown>,
  at: number
): Promise<PropertyViolation[]> {
  const violations: PropertyViolation[] = [];
  for (const m of monitors) {
    if (m.closed || m.pending === null) continue;
    try {
      const value = await resolveObservation(m.pending, ctx);
      await advanceMonitor(m, value, at);
    } catch (e) {
      if (e instanceof PropertyViolation) violations.push(e);
      else {
        violations.push(new PropertyViolation(m.property.name, at, e));
      }
    }
  }
  return violations;
}

export async function closeMonitors(
  monitors: MonitorState[]
): Promise<PropertyViolation[]> {
  const violations: PropertyViolation[] = [];
  for (const m of monitors) {
    if (m.closed) continue;
    try {
      await closeGenerator(m.body);
      m.closed = true;
    } catch (e) {
      violations.push(new PropertyViolation(m.property.name, 'end', e));
    }
  }
  return violations;
}

export type CheckpointResult = {
  readonly transition: Transition;
  readonly choice: Choice;
  readonly violations: readonly PropertyViolation[];
};

/**
 * Apply a probed (or freshly probed) action: finish body → resume monitors → record.
 */
export async function checkpoint<S>(args: {
  readonly action: Action<S>;
  readonly probed: EnabledProbe<S>;
  readonly ctx: DriveContext<S>;
  readonly monitors: MonitorState[];
  readonly t: number;
  readonly payload?: readonly JsonValue[];
}): Promise<CheckpointResult> {
  const before = snapshotMemo(args.ctx.memo);
  await finishProbed(args.probed, args.ctx);
  const violations = await resumeMonitors(
    args.monitors,
    args.ctx as DriveContext<unknown>,
    args.t
  );
  const after = snapshotMemo(args.ctx.memo);
  return {
    transition: {
      t: args.t,
      before,
      action: {
        name: args.action.name,
        payload: args.payload ?? [],
      },
      after,
    },
    choice: {
      action: args.action.name,
      draws: args.probed.draws.slice(),
    },
    violations,
  };
}

export async function scriptedApply<S>(args: {
  readonly action: Action<S>;
  readonly draws: readonly unknown[];
  readonly ctx: DriveContext<S>;
  readonly monitors: MonitorState[];
  readonly t: number;
}): Promise<CheckpointResult> {
  const { createScriptedDraws } = await import('../kernel/rng');
  const scripted = createScriptedDraws(args.draws);
  const probeCtx: DriveContext<S> = {
    ...args.ctx,
    scripted,
  };
  const probed = await probe(args.action, probeCtx, args.ctx.rng);
  if (!probed.enabled) {
    throw new ActionNotEnabled(args.action.name);
  }
  return checkpoint({
    action: args.action,
    probed,
    ctx: probeCtx,
    monitors: args.monitors,
    t: args.t,
    payload: args.draws as JsonValue[],
  });
}

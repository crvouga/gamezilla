import type { JsonValue } from '../kernel/json';
import type { Action, Effect, Observation, Property } from '../system/effect';
import { payloadOf } from '../system/effect';
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
  pending:
    | Observation<unknown, unknown[], JsonValue>
    | import('../system/effect').BoundObservation<unknown, JsonValue>
    | null;
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
 * When the body completes, it is re-invoked (restart-on-complete).
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
      // Restart: property bodies that complete are re-invoked each checkpoint.
      m.body = m.property.watch() as MonitorState['body'];
      const first = await genNext(m.body, undefined);
      if (first.done) {
        m.pending = null;
        return;
      }
      m.pending = first.value as MonitorState['pending'];
      return;
    }
    m.pending = r.value as MonitorState['pending'];
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
      const value = await resolveObservation(
        m.pending as
          | Observation<unknown, unknown[], JsonValue>
          | import('../system/effect').BoundObservation<unknown, JsonValue>,
        ctx
      );
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
 * Apply a probed action: finish body → resume monitors → record.
 */
export async function checkpoint<S>(args: {
  readonly action: Action<S, unknown[]>;
  readonly probed: EnabledProbe<S>;
  readonly ctx: DriveContext<S>;
  readonly monitors: MonitorState[];
  readonly t: number;
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
        payload: payloadOf(args.probed.args),
      },
      after,
    },
    choice: {
      action: args.action.name,
      draws: args.probed.draws.slice(),
      args: args.probed.args.slice(),
    },
    violations,
  };
}

/** Apply with explicit typed args (scripted `run.apply`). */
export async function applyWithArgs<S>(args: {
  readonly action: Action<S, unknown[]>;
  readonly applyArgs: readonly unknown[];
  readonly ctx: DriveContext<S>;
  readonly monitors: MonitorState[];
  readonly t: number;
}): Promise<CheckpointResult> {
  const probed = await probe(
    args.action,
    args.ctx,
    args.ctx.rng,
    args.applyArgs
  );
  if (!probed.enabled) {
    throw new ActionNotEnabled(args.action.name);
  }
  return checkpoint({
    action: args.action,
    probed,
    ctx: args.ctx,
    monitors: args.monitors,
    t: args.t,
  });
}

// Keep Effect import used
export type { Effect };

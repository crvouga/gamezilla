import type { CheckpointAction, Property } from './effect';
import { memoRead, popMemoFrame, pushMemoFrame, snapshotMemo } from './memo';
import type { Step } from './recording';

export class PropertyViolation extends Error {
  readonly property: string;
  readonly at: number | 'dispose';
  constructor(property: string, at: number | 'dispose', cause: unknown) {
    const msg = cause instanceof Error ? cause.message : String(cause);
    super(`PropertyViolation: ${property} at ${String(at)}: ${msg}`);
    this.name = 'PropertyViolation';
    this.property = property;
    this.at = at;
    if (cause instanceof Error) this.cause = cause;
  }
}

export type MonitorState = {
  readonly property: Property<unknown>;
  model: unknown;
  closed: boolean;
};

export type Transition = {
  readonly t: number;
  readonly before: Record<string, unknown>;
  readonly action: { readonly name: string; readonly args: readonly unknown[] };
  readonly after: Record<string, unknown>;
};

export type CheckpointResult = {
  readonly transition: Transition;
  readonly step: Step;
  readonly violations: readonly PropertyViolation[];
};

export async function bootMonitors(
  properties: readonly Property<unknown>[],
  surface: unknown
): Promise<MonitorState[]> {
  const monitors: MonitorState[] = [];
  for (const property of properties) {
    const model =
      property.setup !== undefined ? await property.setup(surface) : undefined;
    monitors.push({ property, model, closed: false });
  }
  return monitors;
}

export async function resumeMonitors(
  monitors: MonitorState[],
  surface: unknown,
  at: number,
  action: CheckpointAction = null
): Promise<PropertyViolation[]> {
  const violations: PropertyViolation[] = [];
  for (const m of monitors) {
    if (m.closed) continue;
    try {
      const next = await m.property.check(surface, m.model, action);
      if (next !== undefined) m.model = next;
    } catch (e) {
      // A throwing verify leaves the stored model untouched.
      m.closed = true;
      violations.push(
        e instanceof PropertyViolation
          ? e
          : new PropertyViolation(m.property.name, at, e)
      );
    }
  }
  return violations;
}

/** Dispose check (`action: null`); the returned model is ignored. */
export async function disposeMonitors(
  monitors: MonitorState[],
  surface: unknown
): Promise<PropertyViolation[]> {
  const violations: PropertyViolation[] = [];
  for (const m of monitors) {
    if (m.closed) continue;
    m.closed = true;
    try {
      await Promise.resolve(m.property.check(surface, m.model, null));
    } catch (e) {
      violations.push(
        e instanceof PropertyViolation
          ? e
          : new PropertyViolation(m.property.name, 'dispose', e)
      );
    }
  }
  return violations;
}

export async function checkpoint<S>(args: {
  readonly actionName: string;
  readonly applyArgs: readonly unknown[];
  readonly act: (s: S, ...a: unknown[]) => unknown | Promise<unknown>;
  readonly surface: S;
  readonly waitForIdle: () => Promise<void>;
  readonly monitors: MonitorState[];
  readonly t: number;
}): Promise<CheckpointResult> {
  const before: Record<string, unknown> = {};
  await args.act(args.surface, ...(args.applyArgs as never[]));
  await args.waitForIdle();
  pushMemoFrame();
  try {
    const violations = await resumeMonitors(
      args.monitors,
      args.surface,
      args.t,
      { name: args.actionName, args: args.applyArgs }
    );
    const after = snapshotMemo();
    return {
      transition: {
        t: args.t,
        before,
        action: { name: args.actionName, args: args.applyArgs },
        after,
      },
      step: { action: args.actionName, args: args.applyArgs },
      violations,
    };
  } finally {
    popMemoFrame();
  }
}

export async function assertProperty<S>(
  p: Property<S>,
  surface: S,
  step: number
): Promise<void> {
  pushMemoFrame();
  try {
    const model =
      p.setup !== undefined ? await p.setup(surface) : (undefined as never);
    await p.check(surface, model, null);
  } catch (e) {
    if (e instanceof PropertyViolation) throw e;
    throw new PropertyViolation(p.name, step, e);
  } finally {
    popMemoFrame();
  }
}

export async function observeRead<S, A extends unknown[], T>(
  read: (s: S, ...args: A) => T | Promise<T>,
  surface: S,
  args: A
): Promise<T> {
  return memoRead(read as never, surface, args);
}

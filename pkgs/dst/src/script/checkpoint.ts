import type { Property } from '../system/effect';
import type { Choice } from '../system/repro';
import { memoRead, popMemoFrame, pushMemoFrame, snapshotMemo } from './memo';

export class PropertyViolation extends Error {
  readonly property: string;
  readonly at: number | 'end';
  constructor(property: string, at: number | 'end', cause: unknown) {
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
  ctx: unknown;
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
  readonly choice: Choice;
  readonly violations: readonly PropertyViolation[];
};

export async function bootMonitors(
  properties: readonly Property<unknown>[],
  surface: unknown
): Promise<MonitorState[]> {
  const monitors: MonitorState[] = [];
  for (const property of properties) {
    const ctx =
      property.setup !== undefined ? await property.setup(surface) : undefined;
    monitors.push({ property, ctx, closed: false });
  }
  return monitors;
}

export async function resumeMonitors(
  monitors: MonitorState[],
  surface: unknown,
  at: number
): Promise<PropertyViolation[]> {
  const violations: PropertyViolation[] = [];
  for (const m of monitors) {
    if (m.closed) continue;
    try {
      const next = await m.property.check(surface, m.ctx);
      if (next !== undefined) m.ctx = next;
    } catch (e) {
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

export async function closeMonitors(
  monitors: MonitorState[]
): Promise<PropertyViolation[]> {
  const violations: PropertyViolation[] = [];
  for (const m of monitors) {
    if (m.closed) continue;
    m.closed = true;
    if (m.property.close === undefined) continue;
    try {
      await m.property.close(m.ctx);
    } catch (e) {
      violations.push(
        e instanceof PropertyViolation
          ? e
          : new PropertyViolation(m.property.name, 'end', e)
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
  readonly settle: () => Promise<void>;
  readonly monitors: MonitorState[];
  readonly t: number;
}): Promise<CheckpointResult> {
  const before: Record<string, unknown> = {};
  await args.act(args.surface, ...(args.applyArgs as never[]));
  await args.settle();
  pushMemoFrame();
  try {
    const violations = await resumeMonitors(
      args.monitors,
      args.surface,
      args.t
    );
    const after = snapshotMemo();
    return {
      transition: {
        t: args.t,
        before,
        action: { name: args.actionName, args: args.applyArgs },
        after,
      },
      choice: { action: args.actionName, args: args.applyArgs },
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
    const ctx =
      p.setup !== undefined ? await p.setup(surface) : (undefined as never);
    await p.check(surface, ctx);
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

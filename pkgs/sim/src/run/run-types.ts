import type { Session } from '../host/types';
import type { Rng } from '../kernel/rng';
import type { Action, Property, Read } from '../system/effect';
import type { ActionSlice, SystemCore as System } from '../system/registry';
import type { Choice } from '../system/repro';
import type { MonitorState, Transition } from './checkpoint';

export type WalkOptions<S> = {
  /**
   * Slice of the walk: registered action names and/or action objects.
   * Default: system actions with `pool !== false`.
   */
  readonly actions?: ActionSlice<S>;
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

/** Rest args: full override, or empty to use `action.args` defaults. */
type ApplyRest<A extends unknown[]> = A | [];

export type Script<S> = {
  /**
   * `A` is inferred from the action alone (`NoInfer` on the rest), so
   * `s.apply(auth, 'c0', 'revoked')` checks the literal against the
   * action's declared union instead of widening it to `string`.
   */
  readonly apply: <A extends unknown[]>(
    action: Action<S, A>,
    ...args: NoInfer<ApplyRest<A>>
  ) => Promise<void>;
  readonly observe: <T, A extends unknown[]>(
    read: Read<S, A, T>,
    ...args: A
  ) => Promise<T>;
  readonly assert: (p: Property<S>) => Promise<void>;
  readonly elapse: (ms: number) => Promise<void>;
  readonly until: <T>(
    read: Read<S, [], T>,
    opts?: {
      readonly maxMs?: number;
      readonly stepMs?: number;
      readonly pred?: (t: T) => boolean;
    }
  ) => Promise<T>;
  readonly never: <T>(
    read: Read<S, [], T>,
    opts: {
      readonly forMs: number;
      readonly stepMs?: number;
      readonly pred?: (t: T) => boolean;
    }
  ) => Promise<void>;
  readonly walk: (opts?: WalkOptions<S>) => Promise<Walk>;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/** Module-private script state — walk / explore / replay only. */
export type ScriptInternal<S> = {
  readonly surface: S;
  readonly session: Session;
  readonly system: System<S, unknown>;
  readonly systemName: string;
  readonly args: unknown;
  readonly hostName: string;
  readonly monitors: MonitorState[];
  readonly transitions: Transition[];
  readonly choices: Choice[];
  rng: Rng;
  step: number;
};

const scriptInternals = new WeakMap<object, ScriptInternal<unknown>>();

export function setScriptInternal<S>(
  s: Script<S>,
  internal: ScriptInternal<S>
): void {
  scriptInternals.set(s as object, internal as ScriptInternal<unknown>);
}

/** Package-internal accessor — not part of the public `Script` surface. */
export function getScriptInternal<S>(s: Script<S>): ScriptInternal<S> {
  const internal = scriptInternals.get(s as object);
  if (internal === undefined) {
    throw new Error('getScriptInternal: script is not registered');
  }
  return internal as ScriptInternal<S>;
}

import type { Awaitable } from './awaitable';
import type { Gen } from './gen';

export const ACTION_TAG = Symbol.for('dst.Action');
export const PROPERTY_TAG = Symbol.for('dst.Property');
export const SYSTEM_TAG = Symbol.for('dst.System');

/**
 * Draw Gen may return the args tuple `A`, or (for a single parameter) the
 * unwrapped element. RandomActionsReport normalizes with Array.isArray.
 */
export type ArgsSampler<A extends unknown[]> = Gen<
  A | (A extends [infer U] ? U : never)
>;

export type ActionDef<S, A extends unknown[] = []> = {
  readonly name: string;
  readonly enabled?: (s: S) => Awaitable<boolean>;
  readonly weight?: number | ((s: S) => Awaitable<number>);
  /** Default apply values when `s.apply(action)` is called with no rest args. */
  readonly args?: A;
  /** RandomActionsReport / explore sampler. */
  readonly sample?: (s: S) => Awaitable<ArgsSampler<A>>;
  /** When false, excluded from explore / randomActions pools (still replayable). Default true. */
  readonly pool?: boolean;
  readonly act: (s: S, ...args: A) => Awaitable<void>;
};

export type CheckpointAction = {
  readonly name: string;
  readonly args: readonly unknown[];
} | null;

export type AppliedAction<A extends unknown[] = unknown[]> = {
  readonly name: string;
  readonly args: A;
};

export type Action<S, A extends unknown[] = []> = {
  readonly [ACTION_TAG]: true;
  readonly name: string;
  readonly enabled: (s: S) => Awaitable<boolean>;
  readonly weight: (s: S) => Awaitable<number>;
  readonly args: A | undefined;
  readonly sample: ((s: S) => Awaitable<ArgsSampler<A>>) | undefined;
  readonly pool: boolean;
  readonly act: (s: S, ...args: A) => Awaitable<void>;
  readonly is: (action: CheckpointAction) => action is AppliedAction<A>;
};

/** Bivariant function slot — catalogs accept any Action / Property args/ctx. */
type BivariantFn<T extends (...args: never[]) => unknown> = {
  bivarianceHack(...args: Parameters<T>): ReturnType<T>;
}['bivarianceHack'];

/**
 * Existential action for walk / explore / replay catalogs so zero-arg and
 * parameterized `Action`s share one array without `any`.
 */
export type CatalogAction<S> = {
  readonly [ACTION_TAG]: true;
  readonly name: string;
  readonly enabled: (s: S) => Awaitable<boolean>;
  readonly weight: (s: S) => Awaitable<number>;
  readonly args: readonly unknown[] | undefined;
  readonly sample: ((s: S) => Awaitable<Gen<unknown>>) | undefined;
  readonly pool: boolean;
  readonly act: BivariantFn<(s: S, ...args: unknown[]) => Awaitable<void>>;
  readonly is: (action: CheckpointAction) => action is AppliedAction<unknown[]>;
};

export type PropertyDef<S, M = void> = {
  readonly name: string;
  /** Initial model for this property (defaults to `undefined`). */
  readonly setup?: (s: S) => Awaitable<M>;
  /**
   * Assert with the pre-update model + SoT, then return the next model
   * (or `void` to keep the current one). The framework never stores a
   * return value from a throwing check.
   */
  readonly check: (
    s: S,
    model: M,
    action: CheckpointAction
  ) => Awaitable<M | void>;
};

export type Property<S, M = unknown> = {
  readonly [PROPERTY_TAG]: true;
  readonly name: string;
  readonly setup: ((s: S) => Awaitable<M>) | undefined;
  readonly check: (
    s: S,
    model: M,
    action: CheckpointAction
  ) => Awaitable<M | void>;
};

/**
 * Existential property for script / explore catalogs so typed properties
 * share one array without `any`.
 */
export type CatalogProperty<S> = {
  readonly [PROPERTY_TAG]: true;
  readonly name: string;
  readonly setup: ((s: S) => Awaitable<unknown>) | undefined;
  readonly check: BivariantFn<
    (s: S, model: unknown, action: CheckpointAction) => Awaitable<unknown>
  >;
};

/** Zero-arg or parameterized pure read of `S`. */
export type Read<S, A extends unknown[] = [], T = unknown> = (
  s: S,
  ...args: A
) => Awaitable<T>;

export function isAction(v: unknown): v is Action<unknown, unknown[]> {
  return (
    typeof v === 'object' &&
    v !== null &&
    ACTION_TAG in v &&
    (v as { [ACTION_TAG]?: boolean })[ACTION_TAG] === true
  );
}

export function isProperty(v: unknown): v is Property<unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    PROPERTY_TAG in v &&
    (v as { [PROPERTY_TAG]?: boolean })[PROPERTY_TAG] === true
  );
}

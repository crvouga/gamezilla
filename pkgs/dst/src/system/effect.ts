import type { JsonValue } from '../kernel/json';
import type { Gen } from './gen';

export const OBSERVATION_TAG = Symbol.for('dst.Observation');
export const DRAW_TAG = Symbol.for('dst.Draw');
export const ACTION_TAG = Symbol.for('dst.Action');
export const PROPERTY_TAG = Symbol.for('dst.Property');
export const SYSTEM_TAG = Symbol.for('dst.System');

/** Act: awaited against the surface, then session.settle(). Bare fn = weight 1. */
export type Act<S> =
  | ((s: S) => unknown)
  | { readonly weight: number; readonly act: (s: S) => unknown };

export type Draw<P> = {
  readonly [DRAW_TAG]: true;
  readonly gen: Gen<P>;
  [Symbol.iterator](): Generator<Draw<P>, P, P>;
};

export type Observation<S, T extends JsonValue = JsonValue> = {
  readonly [OBSERVATION_TAG]: true;
  readonly name: string;
  readonly observe: (
    s: S
  ) =>
    | T
    | Promise<T>
    | Generator<Observation<S, JsonValue>, T, unknown>
    | AsyncGenerator<Observation<S, JsonValue>, T, unknown>;
  [Symbol.iterator](): Generator<Observation<S, T>, T, T>;
};

export type Action<S> = {
  readonly [ACTION_TAG]: true;
  readonly name: string;
  readonly generate: () =>
    | Generator<Effect<S>, void, unknown>
    | AsyncGenerator<Effect<S>, void, unknown>;
  [Symbol.iterator](): Generator<Action<S>, void, void>;
};

export type Property<S> = {
  readonly [PROPERTY_TAG]: true;
  readonly name: string;
  readonly watch: () =>
    | Generator<Observation<S, JsonValue>, void, unknown>
    | AsyncGenerator<Observation<S, JsonValue>, void, unknown>;
};

export type Effect<S> =
  | Observation<S, JsonValue>
  | Draw<unknown>
  | Act<S>
  | Action<S>;

export type Body<S, R> =
  | Generator<Effect<S>, R, unknown>
  | AsyncGenerator<Effect<S>, R, unknown>;

/** Erased surface for type predicates / observe tuples (variance). */
// biome-ignore lint/suspicious/noExplicitAny: surface erasure for Observation variance
type AnyS = any;

export function isObservation(v: unknown): v is Observation<AnyS, JsonValue> {
  return (
    typeof v === 'object' &&
    v !== null &&
    OBSERVATION_TAG in v &&
    (v as { [OBSERVATION_TAG]?: boolean })[OBSERVATION_TAG] === true
  );
}

export function isDraw(v: unknown): v is Draw<unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    DRAW_TAG in v &&
    (v as { [DRAW_TAG]?: boolean })[DRAW_TAG] === true
  );
}

export function isAction(v: unknown): v is Action<unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    ACTION_TAG in v &&
    (v as { [ACTION_TAG]?: boolean })[ACTION_TAG] === true
  );
}

export function isAct<S>(v: unknown): v is Act<S> {
  if (typeof v === 'function') return true;
  if (
    typeof v === 'object' &&
    v !== null &&
    'weight' in v &&
    'act' in v &&
    typeof (v as { act: unknown }).act === 'function' &&
    typeof (v as { weight: unknown }).weight === 'number'
  ) {
    return true;
  }
  return false;
}

export function actWeight<S>(act: Act<S>): number {
  return typeof act === 'function' ? 1 : act.weight;
}

export function actFn<S>(act: Act<S>): (s: S) => unknown {
  return typeof act === 'function' ? act : act.act;
}

/** `draw(gen)` — yield* returns the Gen result; every rng.next() is recorded. */
export function draw<P>(g: Gen<P>): Draw<P> {
  const d: Draw<P> = {
    [DRAW_TAG]: true,
    gen: g,
    *[Symbol.iterator]() {
      return yield d;
    },
  };
  return d;
}

// Surface erased at the tuple boundary — `AnyS` for Observation variance.
type ValuesOf<O extends Observation<AnyS, JsonValue>[]> = {
  [K in keyof O]: O[K] extends Observation<AnyS, infer T> ? T : never;
};

/**
 * Tuple observation: one request, one checkpoint.
 * `const [a, b] = yield* observe(oa, ob)`
 */
export function observe<O extends Observation<AnyS, JsonValue>[]>(
  ...os: O
): Observation<AnyS, ValuesOf<O> & JsonValue> {
  if (os.length === 1) {
    return os[0]! as Observation<AnyS, ValuesOf<O> & JsonValue>;
  }
  const name = `observe(${os.map((o) => o.name).join(',')})`;
  const o: Observation<AnyS, ValuesOf<O> & JsonValue> = {
    [OBSERVATION_TAG]: true,
    name,
    *observe() {
      const values: JsonValue[] = [];
      for (const part of os) {
        values.push((yield part) as JsonValue);
      }
      return values as ValuesOf<O> & JsonValue;
    },
    *[Symbol.iterator]() {
      return yield o;
    },
  };
  return o;
}

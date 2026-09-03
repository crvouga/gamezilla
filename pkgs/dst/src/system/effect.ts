import { fingerprint } from '../kernel/fingerprint';
import type { JsonValue } from '../kernel/json';
import type { Gen } from './gen';

export const OBSERVATION_TAG = Symbol.for('dst.Observation');
export const BOUND_OBSERVATION_TAG = Symbol.for('dst.BoundObservation');
export const DRAW_TAG = Symbol.for('dst.Draw');
export const ACTION_TAG = Symbol.for('dst.Action');
export const BOUND_ACTION_TAG = Symbol.for('dst.BoundAction');
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

/** What an action `generate(...args)` may return. */
export type ActionBody<S> =
  | Act<S>
  | void
  | Promise<Act<S> | void>
  | Generator<Effect<S>, Act<S> | void, unknown>
  | AsyncGenerator<Effect<S>, Act<S> | void, unknown>
  | Iterable<Effect<S>>
  | AsyncIterable<Effect<S>>;

export type BoundObservation<S, T extends JsonValue = JsonValue> = {
  readonly [BOUND_OBSERVATION_TAG]: true;
  readonly observation: Observation<S, unknown[], T>;
  readonly args: readonly unknown[];
  readonly name: string;
  [Symbol.iterator](): Generator<BoundObservation<S, T>, T, T>;
};

export type Observation<
  S,
  A extends unknown[] = [],
  T extends JsonValue = JsonValue,
> = {
  readonly [OBSERVATION_TAG]: true;
  readonly name: string;
  /** Args widened to `unknown[]` so zero-arg observations stay Effect-assignable. */
  readonly observe: (
    s: S,
    ...args: unknown[]
  ) =>
    | T
    | Promise<T>
    | Generator<Effect<S>, T, unknown>
    | AsyncGenerator<Effect<S>, T, unknown>;
  (...args: A): BoundObservation<S, T>;
  [Symbol.iterator](): Generator<
    Observation<S, A, T> | BoundObservation<S, T>,
    T,
    T
  >;
};

export type BoundAction<S> = {
  readonly [BOUND_ACTION_TAG]: true;
  readonly action: Action<S, unknown[]>;
  readonly args: readonly unknown[];
  [Symbol.iterator](): Generator<BoundAction<S>, void, void>;
};

export type Action<S, A extends unknown[] = []> = {
  readonly [ACTION_TAG]: true;
  readonly name: string;
  readonly generate: (...args: A) => ActionBody<S>;
  (...args: A): BoundAction<S>;
  [Symbol.iterator](): Generator<Action<S, A> | BoundAction<S>, void, void>;
};

export type Property<S> = {
  readonly [PROPERTY_TAG]: true;
  readonly name: string;
  readonly watch: () =>
    | Generator<Effect<S>, void, unknown>
    | AsyncGenerator<Effect<S>, void, unknown>;
};

export type Effect<S> =
  | Observation<S, unknown[], JsonValue>
  | BoundObservation<S, JsonValue>
  | Draw<unknown>
  | Act<S>
  | Action<S, unknown[]>
  | BoundAction<S>;

/** Erased surface for type predicates / observe records (variance). */
// biome-ignore lint/suspicious/noExplicitAny: surface erasure for Observation variance
type AnyS = any;

export function isObservation(
  v: unknown
): v is Observation<AnyS, unknown[], JsonValue> {
  return (
    (typeof v === 'function' || (typeof v === 'object' && v !== null)) &&
    OBSERVATION_TAG in (v as object) &&
    (v as { [OBSERVATION_TAG]?: boolean })[OBSERVATION_TAG] === true
  );
}

export function isBoundObservation(
  v: unknown
): v is BoundObservation<AnyS, JsonValue> {
  return (
    typeof v === 'object' &&
    v !== null &&
    BOUND_OBSERVATION_TAG in v &&
    (v as { [BOUND_OBSERVATION_TAG]?: boolean })[BOUND_OBSERVATION_TAG] === true
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

export function isAction(v: unknown): v is Action<unknown, unknown[]> {
  return (
    (typeof v === 'function' || (typeof v === 'object' && v !== null)) &&
    ACTION_TAG in (v as object) &&
    (v as { [ACTION_TAG]?: boolean })[ACTION_TAG] === true
  );
}

export function isBoundAction(v: unknown): v is BoundAction<unknown> {
  return (
    typeof v === 'object' &&
    v !== null &&
    BOUND_ACTION_TAG in v &&
    (v as { [BOUND_ACTION_TAG]?: boolean })[BOUND_ACTION_TAG] === true
  );
}

export function isAct<S>(v: unknown): v is Act<S> {
  if (typeof v === 'function') {
    // Tagged callables (Action / Observation) are not Acts.
    if (ACTION_TAG in v || OBSERVATION_TAG in v) return false;
    return true;
  }
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

export function observationMemoKey(
  name: string,
  args: readonly unknown[]
): string {
  if (args.length === 0) return name;
  try {
    return `${name}:${fingerprint(args as JsonValue)}`;
  } catch {
    return `${name}:${JSON.stringify(payloadOf(args))}`;
  }
}

type ObsLike = {
  readonly name: string;
  readonly [OBSERVATION_TAG]?: true;
  readonly [BOUND_OBSERVATION_TAG]?: true;
};

type ValuesOfRecord<R extends Record<string, ObsLike>> = {
  readonly [K in keyof R]: R[K] extends BoundObservation<AnyS, infer T>
    ? T
    : R[K] extends Observation<AnyS, infer _A, infer T>
      ? T
      : never;
};

/**
 * Named-record observation: one request, one checkpoint.
 * `const o = yield* observe({ quiet, cut: partitioned })`
 */
export function observe<R extends Record<string, ObsLike>>(
  parts: R
): Observation<AnyS, [], ValuesOfRecord<R> & JsonValue> {
  const entries = Object.entries(parts);
  const name = `observe({${entries.map(([k, o]) => `${k}:${o.name}`).join(',')}})`;

  type T = ValuesOfRecord<R> & JsonValue;

  const o = function bind(): BoundObservation<AnyS, T> {
    const bound: BoundObservation<AnyS, T> = {
      [BOUND_OBSERVATION_TAG]: true,
      observation: o as unknown as Observation<AnyS, unknown[], T>,
      args: [],
      name,
      *[Symbol.iterator]() {
        return yield bound;
      },
    };
    return bound;
  } as Observation<AnyS, [], T>;

  Object.defineProperties(o, {
    [OBSERVATION_TAG]: { value: true, enumerable: true },
    observe: {
      value: function* observeFn(
        _s: AnyS
      ): Generator<Effect<AnyS>, T, unknown> {
        const out: Record<string, JsonValue> = {};
        for (const [key, part] of entries) {
          out[key] = (yield part as Effect<AnyS>) as JsonValue;
        }
        return out as T;
      },
      enumerable: true,
    },
    [Symbol.iterator]: {
      value: function* (): Generator<Observation<AnyS, [], T>, T, T> {
        return yield o;
      },
      enumerable: false,
    },
  });
  Object.defineProperty(o, 'name', {
    value: name,
    configurable: true,
  });

  return o;
}

/** Project apply-args into a JSON-safe transition payload. */
export function payloadOf(args: readonly unknown[]): readonly JsonValue[] {
  return args.map((a) => {
    try {
      return JSON.parse(JSON.stringify(a)) as JsonValue;
    } catch {
      return String(a);
    }
  });
}

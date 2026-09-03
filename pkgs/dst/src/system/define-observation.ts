import type { JsonValue } from '../kernel/json';
import {
  type BoundObservation,
  BOUND_OBSERVATION_TAG,
  type Effect,
  OBSERVATION_TAG,
  type Observation,
  observationMemoKey,
} from './effect';

export type ObserveFn<S, A extends unknown[], T extends JsonValue> = (
  s: S,
  ...args: A
) =>
  | T
  | Promise<T>
  | Generator<Effect<S>, T, unknown>
  | AsyncGenerator<Effect<S>, T, unknown>;

type ArgsOfObs<G> = G extends (s: never, ...args: infer A) => unknown
  ? A extends unknown[]
    ? A
    : unknown[]
  : [];
type ResultOfObs<G> = G extends (...args: never[]) => infer R
  ? Awaited<R> extends Generator<unknown, infer T, unknown>
    ? T
    : Awaited<R> extends AsyncGenerator<unknown, infer T, unknown>
      ? T
      : Awaited<R>
  : JsonValue;

export function defineObservation<
  S,
  G extends (
    s: S,
    ...args: never[]
  ) =>
    | JsonValue
    | Promise<JsonValue>
    | Generator<Effect<S>, JsonValue, unknown>
    | AsyncGenerator<Effect<S>, JsonValue, unknown>,
>(def: {
  readonly name: string;
  readonly observe: G;
}): Observation<
  S,
  ArgsOfObs<G>,
  ResultOfObs<G> extends JsonValue ? ResultOfObs<G> : JsonValue
> {
  if (!def.name) throw new Error('defineObservation: name is required');

  type A = ArgsOfObs<G>;
  type T = ResultOfObs<G> extends JsonValue ? ResultOfObs<G> : JsonValue;

  const o = function bind(...args: A): BoundObservation<S, T> {
    const key = observationMemoKey(def.name, args);
    const bound: BoundObservation<S, T> = {
      [BOUND_OBSERVATION_TAG]: true,
      observation: o as unknown as Observation<S, unknown[], T>,
      args,
      name: key,
      *[Symbol.iterator]() {
        return yield bound;
      },
    };
    return bound;
  } as Observation<S, A, T>;

  Object.defineProperties(o, {
    [OBSERVATION_TAG]: { value: true, enumerable: true },
    observe: {
      value: def.observe as unknown as Observation<S, A, T>['observe'],
      enumerable: true,
    },
    [Symbol.iterator]: {
      value: function* (): Generator<
        Observation<S, A, T> | BoundObservation<S, T>,
        T,
        T
      > {
        return yield o;
      },
      enumerable: false,
    },
  });
  Object.defineProperty(o, 'name', {
    value: def.name,
    configurable: true,
  });

  return o as Observation<
    S,
    ArgsOfObs<G>,
    ResultOfObs<G> extends JsonValue ? ResultOfObs<G> : JsonValue
  >;
}

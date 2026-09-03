import type { JsonValue } from '../kernel/json';
import { type Body, OBSERVATION_TAG, type Observation } from './effect';

export type ObserveFn<S, T extends JsonValue> =
  | ((s: S) => T)
  | ((s: S) => Promise<T>)
  | ((s: S) => Generator<Observation<S, JsonValue>, T, unknown>)
  | ((s: S) => AsyncGenerator<Observation<S, JsonValue>, T, unknown>);

export function defineObservation<S, T extends JsonValue>(def: {
  readonly name: string;
  readonly observe: ObserveFn<S, T>;
}): Observation<S, T> {
  if (!def.name) throw new Error('defineObservation: name is required');
  const o: Observation<S, T> = {
    [OBSERVATION_TAG]: true,
    name: def.name,
    observe: def.observe as Observation<S, T>['observe'],
    *[Symbol.iterator]() {
      return yield o;
    },
  };
  return o;
}

export type { Body };

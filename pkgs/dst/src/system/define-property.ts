import type { JsonValue } from '../kernel/json';
import { type Observation, PROPERTY_TAG, type Property } from './effect';

export function defineProperty<S>(def: {
  readonly name: string;
  readonly watch: () =>
    | Generator<Observation<S, JsonValue>, void, unknown>
    | AsyncGenerator<Observation<S, JsonValue>, void, unknown>;
}): Property<S> {
  if (!def.name) throw new Error('defineProperty: name is required');
  return {
    [PROPERTY_TAG]: true,
    name: def.name,
    watch: def.watch,
  };
}

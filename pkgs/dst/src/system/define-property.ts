import { type Effect, PROPERTY_TAG, type Property } from './effect';

export function defineProperty<S>(def: {
  readonly name: string;
  readonly watch: () =>
    | Generator<Effect<S>, void, unknown>
    | AsyncGenerator<Effect<S>, void, unknown>;
}): Property<S> {
  if (!def.name) throw new Error('defineProperty: name is required');
  return {
    [PROPERTY_TAG]: true,
    name: def.name,
    watch: def.watch,
  };
}

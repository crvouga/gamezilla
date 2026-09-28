import type { Awaitable } from './awaitable';
import { type CheckpointAction, PROPERTY_TAG, type Property } from './effect';

/**
 * `M` is inferred from `setup`'s return (`void` when omitted); `check`
 * asserts with that model and may return the next one.
 */
export function defineProperty<S, M = void>(def: {
  readonly name: string;
  readonly setup?: (s: S) => Awaitable<M>;
  readonly check: (
    s: S,
    model: M,
    action: CheckpointAction
  ) => Awaitable<M | void>;
}): Property<S, M> {
  if (!def.name) throw new Error('defineProperty: name is required');
  return {
    [PROPERTY_TAG]: true,
    name: def.name,
    setup: def.setup,
    check: def.check,
  };
}

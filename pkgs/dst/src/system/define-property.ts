import type { Awaitable } from './awaitable';
import { PROPERTY_TAG, type Property } from './effect';

/**
 * `C` is inferred from `setup`'s return (or `void` when omitted).
 * `check` / `close` must agree on that ctx type.
 */
export function defineProperty<S, C = void>(def: {
  readonly name: string;
  readonly setup?: (s: S) => Awaitable<C>;
  readonly check: (s: S, ctx: C) => Awaitable<C | void>;
  readonly close?: (ctx: C) => Awaitable<void>;
}): Property<S, C> {
  if (!def.name) throw new Error('defineProperty: name is required');
  return {
    [PROPERTY_TAG]: true,
    name: def.name,
    setup: def.setup,
    check: def.check,
    close: def.close,
  };
}

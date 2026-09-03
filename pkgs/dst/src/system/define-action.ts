import type { Awaitable } from './awaitable';
import { ACTION_TAG, type Action, type ArgsGen } from './effect';

/**
 * `S` is contravariant on callbacks — callers bind via `defineSurface<S>()`.
 * Args tuple `A` is inferred from `act`'s parameters after `s`.
 */
export function defineAction<S, const A extends unknown[] = []>(def: {
  readonly name: string;
  readonly enabled?: (s: S) => Awaitable<boolean>;
  readonly weight?: number | ((s: S) => Awaitable<number>);
  readonly args?: (s: S) => Awaitable<ArgsGen<A>>;
  readonly act: (s: S, ...args: A) => Awaitable<void>;
}): Action<S, A> {
  if (!def.name) throw new Error('defineAction: name is required');
  const weightFn =
    typeof def.weight === 'function'
      ? def.weight
      : def.weight !== undefined
        ? () => def.weight as number
        : () => 1;
  return {
    [ACTION_TAG]: true,
    name: def.name,
    enabled: def.enabled ?? (() => true),
    weight: weightFn,
    args: def.args,
    act: def.act,
  };
}

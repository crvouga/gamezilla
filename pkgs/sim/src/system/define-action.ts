import { ACTION_TAG, type Action, type ActionDef } from './effect';

/**
 * `S` is contravariant on callbacks — callers bind via `defineSystem` /
 * `system.action`. Args tuple `A` is inferred from `act`'s parameters after `s`.
 */
export function defineAction<S, const A extends unknown[] = []>(
  def: ActionDef<S, A>
): Action<S, A> {
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
    draw: def.draw,
    pool: def.pool !== false,
    act: def.act,
  };
}

import {
  ACTION_TAG,
  type Action,
  type ActionDef,
  type AppliedAction,
  type CheckpointAction,
} from './effect';

/**
 * `S` is contravariant on callbacks — callers bind via `defineSystem({ actions })`. Args tuple `A` is inferred from `act`'s parameters after `s`.
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
    sample: def.sample,
    pool: def.pool !== false,
    describe: def.describe,
    report: def.report !== false,
    act: def.act,
    is: (action: CheckpointAction): action is AppliedAction<A> =>
      action !== null && action.name === def.name,
  };
}

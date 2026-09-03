import {
  ACTION_TAG,
  type Action,
  type ActionBody,
  type BoundAction,
  BOUND_ACTION_TAG,
} from './effect';

/** Infer parameter tuple from a generate function. */
type ArgsOf<G> = G extends (...args: infer A) => unknown ? A : [];

/**
 * `never[]` (not `unknown[]`) so typed params like `(id: string)` remain
 * assignable under function parameter contravariance.
 */
export function defineAction<
  S,
  G extends (...args: never[]) => ActionBody<S>,
>(def: {
  readonly name: string;
  readonly generate: G;
}): Action<S, ArgsOf<G>> {
  if (!def.name) throw new Error('defineAction: name is required');

  type A = ArgsOf<G>;

  const a = function bind(...args: A): BoundAction<S> {
    const bound: BoundAction<S> = {
      [BOUND_ACTION_TAG]: true,
      action: a as unknown as Action<S, unknown[]>,
      args,
      *[Symbol.iterator]() {
        yield bound;
      },
    };
    return bound;
  } as Action<S, A>;

  Object.defineProperties(a, {
    [ACTION_TAG]: { value: true, enumerable: true },
    generate: {
      value: def.generate as (...args: A) => ActionBody<S>,
      enumerable: true,
    },
    [Symbol.iterator]: {
      value: function* (): Generator<
        Action<S, A> | BoundAction<S>,
        void,
        void
      > {
        yield a;
      },
      enumerable: false,
    },
  });
  Object.defineProperty(a, 'name', {
    value: def.name,
    configurable: true,
  });

  return a;
}

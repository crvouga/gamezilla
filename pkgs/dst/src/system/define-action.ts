import { ACTION_TAG, type Action, type Body, type Effect } from './effect';

export function defineAction<S>(def: {
  readonly name: string;
  readonly generate: () =>
    | Generator<Effect<S>, void, unknown>
    | AsyncGenerator<Effect<S>, void, unknown>;
}): Action<S> {
  if (!def.name) throw new Error('defineAction: name is required');
  const a: Action<S> = {
    [ACTION_TAG]: true,
    name: def.name,
    generate: def.generate,
    *[Symbol.iterator]() {
      yield a;
    },
  };
  return a;
}

export type { Body };

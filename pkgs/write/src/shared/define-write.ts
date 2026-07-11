import type { WriteContext } from './write-context';
import type { WriteResult } from './write-result';
import type { WriteStore } from './write-store';

export type WriteDefinition<TInput, TOutput> = {
  readonly name: string;
  readonly parseInput: (raw: unknown) => WriteResult<TInput>;
  readonly authorize: (
    ctx: WriteContext,
    input: TInput,
    store: WriteStore
  ) => Promise<WriteResult<void>>;
  readonly execute: (
    ctx: WriteContext,
    input: TInput,
    store: WriteStore
  ) => Promise<WriteResult<TOutput>>;
};

export function defineWrite<TInput, TOutput>(
  def: WriteDefinition<TInput, TOutput>
): WriteDefinition<TInput, TOutput> {
  return def;
}

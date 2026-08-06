import type { Mutation } from './types';

export function defineMutation<A>(m: Mutation<A>): Mutation<A> {
  return m;
}

import type { Mutation } from './mutations-types';

/**
 * Declare a domain mutation. Bodies must soft-delete (`deleted_at`) — the
 * mutation `tx` rejects domain `DELETE FROM` at apply/replay time.
 */
export function defineMutation<A>(m: Mutation<A>): Mutation<A> {
  return m;
}

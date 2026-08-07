import type { Mutation } from './types';

/**
 * Declare a domain mutation. Bodies must soft-delete (`_deleted_at`) — the
 * mutation `tx` rejects domain `DELETE FROM` at apply/replay time.
 */
export function defineMutation<A>(m: Mutation<A>): Mutation<A> {
  return m;
}

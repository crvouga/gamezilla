import { assert } from '@pkgs/assert';

import type { Mutation, MutationRegistry } from './types';

export function mutationRegistry(
  ms: readonly Mutation<unknown>[]
): MutationRegistry {
  const out: Record<string, Mutation<unknown>> = {};
  for (const m of ms) {
    assert.ok(out[m.name] === undefined, `Duplicate mutation name: ${m.name}`);
    out[m.name] = m;
  }
  return out;
}
